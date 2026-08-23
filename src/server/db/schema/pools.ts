import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const POOL_STATUSES = ['active', 'depleted', 'closed'] as const;
export type PoolStatus = (typeof POOL_STATUSES)[number];
export const poolStatusEnum = pgEnum('pool_status', POOL_STATUSES);

export const matchPools = pgTable(
  'match_pools',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sponsorPublicKey: text('sponsor_public_key').notNull(),
    sponsorName: text('sponsor_name').notNull(),
    causeName: text('cause_name').notNull(),
    causeDescription: text('cause_description').notNull(),
    // Stellar G-address that receives donations + matches for this cause
    causePublicKey: text('cause_public_key').notNull(),
    // Settlement asset: 'XLM' (native, default). Pools settle through the XLM SAC.
    asset: text('asset').notNull().default('XLM'),
    // 32-byte hex key identifying this pool inside the Match Pool Soroban contract.
    poolKey: text('pool_key').notNull(),
    totalFundedMinor: text('total_funded_minor').notNull().default('0'),
    remainingMinor: text('remaining_minor').notNull().default('0'),
    matchedMinor: text('matched_minor').notNull().default('0'),
    status: poolStatusEnum('status').notNull().default('active'),
    // Soroban tx hash of the sponsor's on-chain fund_pool call.
    fundTxHash: text('fund_tx_hash'),
    horizonTxHash: text('horizon_tx_hash'),
    version: integer('version').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index('match_pools_status_idx').on(t.status),
    sponsorIdx: index('match_pools_sponsor_idx').on(t.sponsorPublicKey),
  }),
);

export type MatchPool = typeof matchPools.$inferSelect;
export type NewMatchPool = typeof matchPools.$inferInsert;
