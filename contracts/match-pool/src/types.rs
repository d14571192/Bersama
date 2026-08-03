use soroban_sdk::{contracttype, Address};

/// A single matched-donation pool, keyed in storage by its 32-byte `pool_id`.
///
/// A sponsor funds `total_funded` minor units of `token` into the contract;
/// `remaining` is what is still available to match. Every donor gift is paid
/// straight through the contract to `cause` together with a 1:1 match drawn
/// from `remaining` (capped at `remaining`).
#[contracttype]
#[derive(Clone)]
pub struct Pool {
    /// Address that funded the match pool (and may top it up).
    pub sponsor: Address,
    /// Payout address that receives every gift + its match for this pool.
    pub cause: Address,
    /// Stellar Asset Contract (SAC) of the pool asset (XLM SAC by default).
    pub token: Address,
    /// Lifetime total ever funded into the match pool (monotonic).
    pub total_funded: i128,
    /// Match funds still available to pay out (decremented on each match).
    pub remaining: i128,
    /// Lifetime total matched out of the pool to the cause.
    pub matched: i128,
    /// Lifetime total donated by donors through this pool.
    pub donated: i128,
    /// Number of donations processed through this pool.
    pub donations: u32,
}

/// Returned by `donate` so the app can record the exact on-chain split without
/// re-reading the pool.
#[contracttype]
#[derive(Clone)]
pub struct Receipt {
    /// The donor's gift, in the token's minor units.
    pub donated: i128,
    /// The matching amount drawn from the pool (`min(gift, remaining)`).
    pub matched: i128,
    /// Total paid to the cause this gift (`donated + matched`).
    pub total: i128,
    /// Match funds left in the pool after this gift.
    pub remaining: i128,
}
