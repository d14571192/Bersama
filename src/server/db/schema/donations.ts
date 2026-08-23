import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { matchPools } from './pools';

export const DONATION_STATUSES = ['pending', 'matched', 'failed'] as const;
export type DonationStatus = (typeof DONATION_STATUSES)[number];
export const donationStatusEnum = pgEnum('donation_status', DONATION_STATUSES);

export const donations = pgTable(
  'donations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    poolId: uuid('pool_id')
      .notNull()
      .references(() => matchPools.id, { onDelete: 'cascade' }),
    donorPublicKey: text('donor_public_key').notNull(),
    donorName: text('donor_name').notNull(),
    donorMuxedId: text('donor_muxed_id'),
    asset: text('asset').notNull().default('XLM'),
    amountMinor: text('amount_minor').notNull(),
    matchedAmountMinor: text('matched_amount_minor').notNull().default('0'),
    totalImpactMinor: text('total_impact_minor').notNull().default('0'),
    status: donationStatusEnum('status').notNull().default('pending'),
    horizonTxHash: text('horizon_tx_hash'),
    matchTxHash: text('match_tx_hash'),
    memo: text('memo'),
    version: integer('version').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    poolIdx: index('donations_pool_idx').on(t.poolId),
    donorIdx: index('donations_donor_idx').on(t.donorPublicKey),
    statusIdx: index('donations_status_idx').on(t.status),
    createdAtIdx: index('donations_created_at_idx').on(t.createdAt),
  }),
);

export type Donation = typeof donations.$inferSelect;
export type NewDonation = typeof donations.$inferInsert;
