#![cfg(test)]

use crate::{MatchPool, MatchPoolClient};

use soroban_sdk::testutils::Address as _;
use soroban_sdk::token::{Client as TokenClient, StellarAssetClient};
use soroban_sdk::{Address, BytesN, Env};

struct Setup<'a> {
    env: Env,
    client: MatchPoolClient<'a>,
    contract: Address,
    token: Address,
    token_client: TokenClient<'a>,
    admin: Address,
    sponsor: Address,
    donor: Address,
    cause: Address,
}

fn setup<'a>(sponsor_mint: i128, donor_mint: i128) -> Setup<'a> {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let sponsor = Address::generate(&env);
    let donor = Address::generate(&env);
    let cause = Address::generate(&env);

    // Deploy a Stellar Asset Contract to stand in for the XLM SAC.
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token = sac.address();
    let mint = StellarAssetClient::new(&env, &token);
    mint.mint(&sponsor, &sponsor_mint);
    mint.mint(&donor, &donor_mint);

    let contract_id = env.register(MatchPool, ());
    let client = MatchPoolClient::new(&env, &contract_id);
    client.initialize(&admin, &token);

    Setup {
        token_client: TokenClient::new(&env, &token),
        env,
        client,
        contract: contract_id,
        token,
        admin,
        sponsor,
        donor,
        cause,
    }
}

fn pool_id(env: &Env, tag: u8) -> BytesN<32> {
    BytesN::from_array(env, &[tag; 32])
}

#[test]
fn initialize_records_admin_and_token() {
    let s = setup(1_000, 1_000);
    assert_eq!(s.client.get_token(), s.token);
    assert_eq!(s.client.get_admin(), s.admin);
    assert_eq!(s.client.is_paused(), false);
    assert_eq!(s.client.total_donated(), 0);
    assert_eq!(s.client.total_matched(), 0);
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")] // AlreadyInitialized
fn double_initialize_fails() {
    let s = setup(1_000, 1_000);
    s.client.initialize(&s.admin, &s.token);
}

#[test]
fn fund_pool_locks_match_fund() {
    let s = setup(1_000, 0);
    let p = pool_id(&s.env, 1);

    let pool = s.client.fund_pool(&s.sponsor, &p, &s.cause, &600);
    assert_eq!(pool.total_funded, 600);
    assert_eq!(pool.remaining, 600);
    assert_eq!(pool.sponsor, s.sponsor);
    assert_eq!(pool.cause, s.cause);

    // Sponsor debited, contract custodies the match fund.
    assert_eq!(s.token_client.balance(&s.sponsor), 400);
    assert_eq!(s.token_client.balance(&s.contract), 600);
}

#[test]
fn fund_pool_tops_up() {
    let s = setup(1_000, 0);
    let p = pool_id(&s.env, 2);
    s.client.fund_pool(&s.sponsor, &p, &s.cause, &300);
    let pool = s.client.fund_pool(&s.sponsor, &p, &s.cause, &200);
    assert_eq!(pool.total_funded, 500);
    assert_eq!(pool.remaining, 500);
    assert_eq!(s.token_client.balance(&s.contract), 500);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")] // InvalidAmount
fn fund_pool_zero_fails() {
    let s = setup(1_000, 0);
    let p = pool_id(&s.env, 3);
    s.client.fund_pool(&s.sponsor, &p, &s.cause, &0);
}

#[test]
#[should_panic(expected = "Error(Contract, #7)")] // WrongSponsor
fn fund_pool_wrong_sponsor_fails() {
    let s = setup(1_000, 1_000);
    let p = pool_id(&s.env, 4);
    s.client.fund_pool(&s.sponsor, &p, &s.cause, &300);
    // donor (a different address) tries to top up the same pool.
    s.client.fund_pool(&s.donor, &p, &s.cause, &100);
}

#[test]
fn donate_pays_cause_gift_plus_match_atomically() {
    let s = setup(1_000, 1_000);
    let p = pool_id(&s.env, 5);
    s.client.fund_pool(&s.sponsor, &p, &s.cause, &500);

    // Donor gives 200; match is min(200, 500) = 200; cause gets 400.
    let r = s.client.donate(&s.donor, &p, &200);
    assert_eq!(r.donated, 200);
    assert_eq!(r.matched, 200);
    assert_eq!(r.total, 400);
    assert_eq!(r.remaining, 300);

    assert_eq!(s.token_client.balance(&s.donor), 800);
    assert_eq!(s.token_client.balance(&s.cause), 400);
    // Contract held 500, paid 200 match, kept 300.
    assert_eq!(s.token_client.balance(&s.contract), 300);

    let pool = s.client.get_pool(&p);
    assert_eq!(pool.matched, 200);
    assert_eq!(pool.donated, 200);
    assert_eq!(pool.remaining, 300);
    assert_eq!(pool.donations, 1);
    assert_eq!(s.client.total_donated(), 200);
    assert_eq!(s.client.total_matched(), 200);
}

#[test]
fn donate_caps_match_at_remaining_pool() {
    let s = setup(1_000, 1_000);
    let p = pool_id(&s.env, 6);
    s.client.fund_pool(&s.sponsor, &p, &s.cause, &50);

    // Donor gives 200 but only 50 of match is left; cause gets 250.
    let r = s.client.donate(&s.donor, &p, &200);
    assert_eq!(r.donated, 200);
    assert_eq!(r.matched, 50);
    assert_eq!(r.total, 250);
    assert_eq!(r.remaining, 0);

    assert_eq!(s.token_client.balance(&s.cause), 250);
    assert_eq!(s.token_client.balance(&s.contract), 0);

    // A second gift after the pool is drained still flows, with zero match.
    let r2 = s.client.donate(&s.donor, &p, &100);
    assert_eq!(r2.matched, 0);
    assert_eq!(r2.total, 100);
    assert_eq!(s.token_client.balance(&s.cause), 350);
    let pool = s.client.get_pool(&p);
    assert_eq!(pool.donations, 2);
    assert_eq!(pool.donated, 300);
    assert_eq!(pool.matched, 50);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")] // PoolNotFound
fn donate_unknown_pool_fails() {
    let s = setup(1_000, 1_000);
    let p = pool_id(&s.env, 7);
    s.client.donate(&s.donor, &p, &100);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")] // InvalidAmount
fn donate_zero_fails() {
    let s = setup(1_000, 1_000);
    let p = pool_id(&s.env, 8);
    s.client.fund_pool(&s.sponsor, &p, &s.cause, &500);
    s.client.donate(&s.donor, &p, &0);
}

#[test]
fn pools_are_isolated() {
    let s = setup(1_000, 1_000);
    let p1 = pool_id(&s.env, 10);
    let p2 = pool_id(&s.env, 11);
    s.client.fund_pool(&s.sponsor, &p1, &s.cause, &300);
    s.client.fund_pool(&s.sponsor, &p2, &s.cause, &400);

    s.client.donate(&s.donor, &p1, &100);
    let a = s.client.get_pool(&p1);
    let b = s.client.get_pool(&p2);
    assert_eq!(a.remaining, 200);
    assert_eq!(b.remaining, 400); // untouched
}

#[test]
fn pause_blocks_funding_and_donations() {
    let s = setup(1_000, 1_000);
    let p = pool_id(&s.env, 12);
    s.client.fund_pool(&s.sponsor, &p, &s.cause, &300);

    s.client.pause();
    assert_eq!(s.client.is_paused(), true);

    // Funding while paused panics with Paused (#3).
    let r = s.client.try_fund_pool(&s.sponsor, &p, &s.cause, &100);
    assert!(r.is_err());
    let d = s.client.try_donate(&s.donor, &p, &100);
    assert!(d.is_err());

    s.client.unpause();
    assert_eq!(s.client.is_paused(), false);
    // Works again after unpause.
    let r2 = s.client.donate(&s.donor, &p, &100);
    assert_eq!(r2.matched, 100);
}

#[test]
fn set_admin_transfers_control() {
    let s = setup(1_000, 1_000);
    let new_admin = Address::generate(&s.env);
    s.client.set_admin(&new_admin);
    assert_eq!(s.client.get_admin(), new_admin);
}

#[test]
fn pool_remaining_view_for_unknown_pool_is_zero() {
    let s = setup(1_000, 1_000);
    let p = pool_id(&s.env, 13);
    assert_eq!(s.client.pool_remaining(&p), 0);
}
