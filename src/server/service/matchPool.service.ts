import { and, count, countDistinct, desc, eq, lt, notInArray, sql, sum } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { db } from '@/server/db/client';
import { donations, matchPools, sessions } from '@/server/db/schema';
import type { Donation, DonationStatus, MatchPool, PoolStatus } from '@/server/db/schema';
import { eventBus } from '@/server/lib/eventBus';
import { AppError } from '@/server/lib/http';
import { submitDonate, submitFundPool } from '@/server/stellar';
import { formatAmount, truncateKey } from '@/lib/assets';

export const DEFAULT_PAGE_SIZE = 30;
export const MAX_PAGE_SIZE = 100;

export type PoolListQuery = {
  status?: PoolStatus;
  cursor?: string;
  limit?: number;
};

export type DonationListQuery = {
  poolId?: string;
  status?: DonationStatus;
  cursor?: string;
  limit?: number;
};

export const matchPoolService = {
  async recordFundedPool(params: {
    sponsorPublicKey: string;
    sponsorName: string;
    causeName: string;
    causeDescription: string;
    causePublicKey: string;
    poolKey: string;
    totalFundedMinor: string;
    remainingMinor: string;
    fundTxHash: string;
  }): Promise<MatchPool> {
    const [pool] = await db
      .insert(matchPools)
      .values({
        sponsorPublicKey: params.sponsorPublicKey,
        sponsorName: params.sponsorName,
        causeName: params.causeName,
        causeDescription: params.causeDescription,
        causePublicKey: params.causePublicKey,
        asset: 'XLM',
        poolKey: params.poolKey,
        totalFundedMinor: params.totalFundedMinor,
        remainingMinor: params.remainingMinor,
        matchedMinor: '0',
        fundTxHash: params.fundTxHash,
      })
      .returning();

    eventBus.publish('pool.updated', {
      poolId: pool.id,
      remainingMinor: pool.remainingMinor,
      matchedMinor: pool.matchedMinor,
      status: pool.status,
      occurredAt: new Date(),
    });

    return pool;
  },

  /** Submit the sponsor-signed fund_pool invoke and persist the pool. */
  async confirmPool(params: {
    sponsorPublicKey: string;
    sponsorName: string;
    causeName: string;
    causeDescription: string;
    causePublicKey: string;
    poolKey: string;
    signedXdr: string;
  }): Promise<MatchPool> {
    const fund = await submitFundPool(params.signedXdr);
    return this.recordFundedPool({
      sponsorPublicKey: params.sponsorPublicKey,
      sponsorName: params.sponsorName,
      causeName: params.causeName,
      causeDescription: params.causeDescription,
      causePublicKey: params.causePublicKey,
      poolKey: params.poolKey,
      totalFundedMinor: fund.totalFunded,
      remainingMinor: fund.remaining,
      fundTxHash: fund.hash,
    });
  },

  async listPools(
    query: PoolListQuery = {},
  ): Promise<{ pools: MatchPool[]; nextCursor: string | null }> {
    const pageSize = query.limit ?? DEFAULT_PAGE_SIZE;
    const filters = [];
    if (query.status) filters.push(eq(matchPools.status, query.status));
    if (query.cursor) filters.push(lt(matchPools.createdAt, new Date(query.cursor)));

    const pools = await db
      .select()
      .from(matchPools)
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(desc(matchPools.createdAt))
      .limit(pageSize);

    return { pools, nextCursor: nextCursorFor(pools, pageSize) };
  },

  async getPool(id: string): Promise<MatchPool> {
    const [pool] = await db.select().from(matchPools).where(eq(matchPools.id, id)).limit(1);
    if (!pool) throw new AppError('NOT_FOUND', 'Match pool not found', 404);
    return pool;
  },

  async listDonations(
    query: DonationListQuery = {},
  ): Promise<{ donations: Donation[]; nextCursor: string | null }> {
    const pageSize = query.limit ?? DEFAULT_PAGE_SIZE;
    const filters = [];
    if (query.poolId) filters.push(eq(donations.poolId, query.poolId));
    if (query.status) filters.push(eq(donations.status, query.status));
    if (query.cursor) filters.push(lt(donations.createdAt, new Date(query.cursor)));

    const rows = await db
      .select()
      .from(donations)
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(desc(donations.createdAt))
      .limit(pageSize);

    return { donations: rows, nextCursor: nextCursorFor(rows, pageSize) };
  },

  async confirmDonation(params: {
    poolId: string;
    donorPublicKey: string;
    signedXdr: string;
    memo?: string;
  }): Promise<Donation> {
    const [pool] = await db
      .select()
      .from(matchPools)
      .where(and(eq(matchPools.id, params.poolId), eq(matchPools.status, 'active')))
      .limit(1);
    if (!pool) throw new AppError('NOT_FOUND', 'Active match pool not found', 404);

    const receipt = await submitDonate(params.signedXdr);

    const [donation] = await db
      .insert(donations)
      .values({
        poolId: params.poolId,
        donorPublicKey: params.donorPublicKey,
        donorName: truncateKey(params.donorPublicKey),
        asset: 'XLM',
        amountMinor: receipt.donated,
        matchedAmountMinor: receipt.matched,
        totalImpactMinor: receipt.total,
        status: 'matched',
        horizonTxHash: receipt.hash,
        matchTxHash: receipt.hash,
        memo: params.memo,
      })
      .returning();

    const ledger = await applyPoolLedgerSettlement({
      poolId: params.poolId,
      remainingMinor: BigInt(receipt.remaining),
      matchedIncrementMinor: BigInt(receipt.matched),
    });

    eventBus.publish('donation.matched', {
      donationId: donation.id,
      poolId: params.poolId,
      donorName: donation.donorName,
      amountMinor: donation.amountMinor,
      matchedAmountMinor: donation.matchedAmountMinor,
      totalImpactMinor: donation.totalImpactMinor,
      status: donation.status,
      occurredAt: new Date(),
    });
    eventBus.publish('pool.updated', {
      poolId: params.poolId,
      remainingMinor: ledger.remainingMinor,
      matchedMinor: ledger.matchedMinor,
      status: ledger.status,
      occurredAt: new Date(),
    });

    return donation;
  },

  async getPoolStats(): Promise<{
    totalDonors: number;
    totalDonatedMinor: string;
    totalMatchedMinor: string;
    totalImpactMinor: string;
    activePools: number;
  }> {
    const [donationTotals] = await db
      .select({
        donorCount: countDistinct(donations.donorPublicKey),
        donatedMinor: sumOfMinorAmounts(donations.amountMinor),
        matchedMinor: sumOfMinorAmounts(donations.matchedAmountMinor),
      })
      .from(donations)
      .where(eq(donations.status, 'matched'));

    const [poolTotals] = await db
      .select({ activeCount: count() })
      .from(matchPools)
      .where(eq(matchPools.status, 'active'));

    const totalDonated = BigInt(minorAmountOrZero(donationTotals?.donatedMinor));
    const totalMatched = BigInt(minorAmountOrZero(donationTotals?.matchedMinor));
    return {
      totalDonors: donationTotals?.donorCount ?? 0,
      totalDonatedMinor: totalDonated.toString(),
      totalMatchedMinor: totalMatched.toString(),
      totalImpactMinor: (totalDonated + totalMatched).toString(),
      activePools: poolTotals?.activeCount ?? 0,
    };
  },

  async getInteractionStats(): Promise<{
    uniqueWallets: number;
    logins: number;
    pools: number;
    donations: number;
    totalMatchedMinor: string;
    totalImpactMinor: string;
    onChainTxs: number;
  }> {
    const [sessionTotals] = await db
      .select({
        walletCount: countDistinct(sessions.publicKey),
        loginCount: count(),
      })
      .from(sessions)
      .where(notInArray(sessions.publicKey, DEMO_PUBLIC_KEYS));

    const [poolTotals] = await db
      .select({
        poolCount: count(),
        fundedOnChainCount: count(matchPools.fundTxHash),
      })
      .from(matchPools);

    const [donationTotals] = await db
      .select({
        donationCount: count(),
        matchedMinor: sumOfMinorAmounts(donations.matchedAmountMinor),
        impactMinor: sumOfMinorAmounts(donations.totalImpactMinor),
        settledOnChainCount: count(donations.horizonTxHash),
      })
      .from(donations)
      .where(eq(donations.status, 'matched'));

    return {
      uniqueWallets: sessionTotals?.walletCount ?? 0,
      logins: sessionTotals?.loginCount ?? 0,
      pools: poolTotals?.poolCount ?? 0,
      donations: donationTotals?.donationCount ?? 0,
      totalMatchedMinor: BigInt(minorAmountOrZero(donationTotals?.matchedMinor)).toString(),
      totalImpactMinor: BigInt(minorAmountOrZero(donationTotals?.impactMinor)).toString(),
      onChainTxs:
        (donationTotals?.settledOnChainCount ?? 0) + (poolTotals?.fundedOnChainCount ?? 0),
    };
  },
};

const DEMO_PUBLIC_KEYS = [
  'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
  'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
];

const POOL_LEDGER_SETTLEMENT_ATTEMPTS = 3;

async function applyPoolLedgerSettlement(params: {
  poolId: string;
  remainingMinor: bigint;
  matchedIncrementMinor: bigint;
}): Promise<{ remainingMinor: string; matchedMinor: string; status: 'active' | 'depleted' }> {
  const status = params.remainingMinor <= 0n ? 'depleted' : 'active';

  for (let attempt = 0; attempt < POOL_LEDGER_SETTLEMENT_ATTEMPTS; attempt += 1) {
    const [current] = await db
      .select()
      .from(matchPools)
      .where(eq(matchPools.id, params.poolId))
      .limit(1);
    if (!current) throw new AppError('NOT_FOUND', 'Match pool not found', 404);

    const matchedMinor = (BigInt(current.matchedMinor) + params.matchedIncrementMinor).toString();
    const settledRows = await db
      .update(matchPools)
      .set({
        remainingMinor: params.remainingMinor.toString(),
        matchedMinor,
        status,
        version: sql`${matchPools.version} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(matchPools.id, params.poolId), eq(matchPools.version, current.version)))
      .returning({ id: matchPools.id });

    if (settledRows.length > 0) {
      return { remainingMinor: params.remainingMinor.toString(), matchedMinor, status };
    }
  }

  throw new AppError('CONFLICT', 'Match pool ledger changed while settling this donation', 409);
}

function nextCursorFor(rows: { createdAt: Date }[], pageSize: number): string | null {
  if (rows.length < pageSize) return null;
  return rows[rows.length - 1].createdAt.toISOString();
}

function sumOfMinorAmounts(column: AnyPgColumn) {
  return sum(sql`${column}::numeric`);
}

function minorAmountOrZero(total: string | null | undefined): string {
  return total ?? '0';
}

export { formatAmount };