#![no_std]
//! # Match Pool
//!
//! A Soroban smart contract that powers **Bersama**'s matched giving. A sponsor
//! funds a 1:1 match pool for a cause; whenever a donor gives, the contract pays
//! the cause the **gift plus a matching amount drawn from the pool** — both legs
//! settle in a single atomic on-chain transaction.
//!
//! ## Properties
//! - **Atomic match.** `donate` pulls the gift from the donor and pays the cause
//!   `gift + match` from the contract in one transaction. Either the whole thing
//!   settles or none of it does — the cause can never be paid a gift without its
//!   match (or vice-versa).
//! - **Real custody of the match fund** via the Stellar Asset Contract (SAC). The
//!   default token recorded at init is the native **XLM** SAC — no trustline.
//! - **1:1 up to the remaining pool.** Each match is `min(gift, remaining)`; once
//!   the pool is drained, gifts still flow to the cause with a zero match.
//! - **Per-pool accounting** — `remaining`, `matched`, `donated` and a donation
//!   counter are tracked on-chain per pool and exposed as views.
//! - **Authorization** — `require_auth` on the sponsor for `fund_pool` and on the
//!   donor for `donate`; the contract authorizes its own match payout.
//! - **Admin + pausable + upgradeable** — operational safety. Pausing blocks new
//!   funding/donations but never traps already-pooled funds.
//! - **Events** — `init`, `fund`, `donate`, `pause` for indexers.

mod error;
mod storage;
mod types;

#[cfg(test)]
mod test;

use error::Error;
use storage::{
    DataKey, INSTANCE_BUMP_AMOUNT, INSTANCE_LIFETIME_THRESHOLD, POOL_BUMP_AMOUNT,
    POOL_LIFETIME_THRESHOLD,
};
use types::{Pool, Receipt};

use soroban_sdk::{contract, contractimpl, symbol_short, token, Address, BytesN, Env};

#[contract]
pub struct MatchPool;

#[contractimpl]
impl MatchPool {
    /// One-time setup. Records the admin (the deployer) and the default token
    /// (the XLM Stellar Asset Contract), and unpauses the contract.
    pub fn initialize(env: Env, admin: Address, token: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage().instance().set(&DataKey::TotalDonated, &0i128);
        env.storage().instance().set(&DataKey::TotalMatched, &0i128);
        bump_instance(&env);
        env.events().publish((symbol_short!("init"),), (admin, token));
        Ok(())
    }

    /// Fund (or top up) the match pool `pool_id` for `cause` with `amount` of the
    /// configured token, locking it in the contract. Creates the pool on first
    /// call (binding its `sponsor` and `cause`); accumulates on later calls by
    /// the same sponsor for the same cause. Returns the updated pool.
    ///
    /// Auth: the sponsor's signature, which also covers the inner SAC
    /// `transfer(sponsor -> contract)`.
    pub fn fund_pool(
        env: Env,
        sponsor: Address,
        pool_id: BytesN<32>,
        cause: Address,
        amount: i128,
    ) -> Result<Pool, Error> {
        sponsor.require_auth();
        require_not_paused(&env)?;
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let token = get_token(&env)?;
        let key = DataKey::Pool(pool_id.clone());

        let mut pool = match env.storage().persistent().get::<_, Pool>(&key) {
            Some(existing) => {
                if existing.sponsor != sponsor {
                    return Err(Error::WrongSponsor);
                }
                if existing.cause != cause {
                    return Err(Error::WrongCause);
                }
                existing
            }
            None => Pool {
                sponsor: sponsor.clone(),
                cause: cause.clone(),
                token: token.clone(),
                total_funded: 0,
                remaining: 0,
                matched: 0,
                donated: 0,
                donations: 0,
            },
        };

        // Lock the match fund into the contract's custody.
        token::Client::new(&env, &token).transfer(
            &sponsor,
            &env.current_contract_address(),
            &amount,
        );

        pool.total_funded += amount;
        pool.remaining += amount;
        save_pool(&env, &key, &pool);
        bump_instance(&env);

        env.events()
            .publish((symbol_short!("fund"), sponsor), (pool_id, amount, pool.remaining));
        Ok(pool)
    }

    /// Donate `amount` to the pool's cause. The contract pulls the gift from the
    /// donor, then pays the cause `gift + match` where `match = min(gift,
    /// remaining)`. Both legs settle atomically. Returns the on-chain split.
    ///
    /// Auth: the donor's signature, which also covers the inner SAC
    /// `transfer(donor -> contract)`. The contract authorizes its own payout.
    pub fn donate(
        env: Env,
        donor: Address,
        pool_id: BytesN<32>,
        amount: i128,
    ) -> Result<Receipt, Error> {
        donor.require_auth();
        require_not_paused(&env)?;
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let key = DataKey::Pool(pool_id.clone());
        let mut pool = env
            .storage()
            .persistent()
            .get::<_, Pool>(&key)
            .ok_or(Error::PoolNotFound)?;

        let client = token::Client::new(&env, &pool.token);
        let contract = env.current_contract_address();

        // 1) Pull the gift from the donor into the contract.
        client.transfer(&donor, &contract, &amount);

        // 2) Compute the 1:1 match, capped at what is left in the pool.
        let matched = if amount <= pool.remaining { amount } else { pool.remaining };
        let total = amount + matched;

        // 3) Pay the cause the gift plus its match in one transfer.
        client.transfer(&contract, &pool.cause, &total);

        // 4) Update on-chain accounting.
        pool.remaining -= matched;
        pool.matched += matched;
        pool.donated += amount;
        pool.donations += 1;
        save_pool(&env, &key, &pool);

        let td: i128 = env.storage().instance().get(&DataKey::TotalDonated).unwrap_or(0);
        let tm: i128 = env.storage().instance().get(&DataKey::TotalMatched).unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalDonated, &(td + amount));
        env.storage().instance().set(&DataKey::TotalMatched, &(tm + matched));
        bump_instance(&env);

        env.events()
            .publish((symbol_short!("donate"), donor), (pool_id, amount, matched));

        Ok(Receipt { donated: amount, matched, total, remaining: pool.remaining })
    }

    // --- Views -------------------------------------------------------------

    pub fn get_pool(env: Env, pool_id: BytesN<32>) -> Result<Pool, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Pool(pool_id))
            .ok_or(Error::PoolNotFound)
    }

    pub fn pool_remaining(env: Env, pool_id: BytesN<32>) -> i128 {
        env.storage()
            .persistent()
            .get::<_, Pool>(&DataKey::Pool(pool_id))
            .map(|p| p.remaining)
            .unwrap_or(0)
    }

    pub fn total_donated(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::TotalDonated).unwrap_or(0)
    }

    pub fn total_matched(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::TotalMatched).unwrap_or(0)
    }

    pub fn is_paused(env: Env) -> bool {
        env.storage().instance().get(&DataKey::Paused).unwrap_or(false)
    }

    pub fn get_token(env: Env) -> Result<Address, Error> {
        get_token(&env)
    }

    pub fn get_admin(env: Env) -> Result<Address, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)
    }

    // --- Admin -------------------------------------------------------------

    pub fn pause(env: Env) -> Result<(), Error> {
        admin(&env)?.require_auth();
        env.storage().instance().set(&DataKey::Paused, &true);
        bump_instance(&env);
        env.events().publish((symbol_short!("pause"),), true);
        Ok(())
    }

    pub fn unpause(env: Env) -> Result<(), Error> {
        admin(&env)?.require_auth();
        env.storage().instance().set(&DataKey::Paused, &false);
        bump_instance(&env);
        env.events().publish((symbol_short!("pause"),), false);
        Ok(())
    }

    pub fn set_admin(env: Env, new_admin: Address) -> Result<(), Error> {
        admin(&env)?.require_auth();
        env.storage().instance().set(&DataKey::Admin, &new_admin);
        bump_instance(&env);
        Ok(())
    }

    /// Replace the contract's own code (admin-gated). Enables shipping fixes
    /// without migrating pooled funds.
    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) -> Result<(), Error> {
        admin(&env)?.require_auth();
        env.deployer().update_current_contract_wasm(new_wasm_hash);
        Ok(())
    }
}

// --- Internal helpers ------------------------------------------------------

fn admin(env: &Env) -> Result<Address, Error> {
    env.storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(Error::NotInitialized)
}

fn get_token(env: &Env) -> Result<Address, Error> {
    env.storage()
        .instance()
        .get(&DataKey::Token)
        .ok_or(Error::NotInitialized)
}

fn require_not_paused(env: &Env) -> Result<(), Error> {
    let paused: bool = env
        .storage()
        .instance()
        .get(&DataKey::Paused)
        .ok_or(Error::NotInitialized)?;
    if paused {
        return Err(Error::Paused);
    }
    Ok(())
}

fn save_pool(env: &Env, key: &DataKey, pool: &Pool) {
    env.storage().persistent().set(key, pool);
    env.storage()
        .persistent()
        .extend_ttl(key, POOL_LIFETIME_THRESHOLD, POOL_BUMP_AMOUNT);
}

fn bump_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
}
