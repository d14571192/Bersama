use soroban_sdk::{contracttype, BytesN};

/// Storage keys. `Pool` lives in *persistent* storage (match funds must outlive
/// the contract instance so they are never stranded); `Admin`/`Token`/`Paused`/
/// totals live in *instance* storage so they share the instance TTL.
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    /// Default token (the XLM Stellar Asset Contract) recorded at init.
    Token,
    Paused,
    /// Running total donated across every pool.
    TotalDonated,
    /// Running total matched across every pool.
    TotalMatched,
    /// pool_id -> Pool
    Pool(BytesN<32>),
}

// Soroban ledgers close ~every 5s -> 17,280 ledgers/day.
pub const DAY_IN_LEDGERS: u32 = 17_280;

// Keep the contract instance (admin/config) alive ~30 days, re-bumped on every
// state-changing call.
pub const INSTANCE_BUMP_AMOUNT: u32 = 30 * DAY_IN_LEDGERS;
pub const INSTANCE_LIFETIME_THRESHOLD: u32 = INSTANCE_BUMP_AMOUNT - DAY_IN_LEDGERS;

// Pool entries are bumped to ~90 days so match funds can never expire out from
// under a sponsor before donors draw them down.
pub const POOL_BUMP_AMOUNT: u32 = 90 * DAY_IN_LEDGERS;
pub const POOL_LIFETIME_THRESHOLD: u32 = POOL_BUMP_AMOUNT - DAY_IN_LEDGERS;
