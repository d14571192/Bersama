import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { donations, matchPools, sessions } from '@/server/db/schema';
import type { Donation, MatchPool } from '@/server/db/schema';
import { eventBus } from '@/server/lib/eventBus';
import { AppError } from '@/server/lib/http';
import { submitDonate, submitFundPool, readPoolBalanceStroops } from '@/server/stellar';
import { formatAmount, truncateKey } from '@/lib/assets';

export const matchPoolService = {
  // ── Pool operations ──────────────────────────────────────────────────

  /**
   * Persist a pool AFTER its sponsor has funded the match on-chain. The
   * `poolKey`, `fundTxHash`, and funded amount all come from the settled
   * Soroban `fund_pool` invoke — nothing is recorded that didn't settle.
   */
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

  async listPools(): Promise<MatchPool[]> {
    return db.select().from(matchPools).orderBy(desc(matchPools.createdAt)).limit(30);
  },

  async getPool(id: string): Promise<MatchPool> {
    const [pool] = await db.select().from(matchPools).where(eq(matchPools.id, id)).limit(1);
    if (!pool) throw new AppError('NOT_FOUND', 'Match pool not found', 404);
    return pool;
  },

  // ── Donation flow (real on-chain via the Match Pool contract) ─────────

  /**
   * Confirm a donation by submitting the donor-signed `donate` invoke. The
   * contract atomically pays the cause the gift + its 1:1 match and returns the
   * exact split, which we persist and use to refresh the pool ledger.
   */
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

    // Submit the atomic on-chain gift + match.
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
        matchTxHash: receipt.hash, // same atomic tx settles both legs
        memo: params.memo,
      })
      .returning();

    // Refresh the pool ledger from the contract's authoritative remaining.
    const newRemaining = BigInt(receipt.remaining);
    const newMatched = BigInt(pool.matchedMinor) + BigInt(receipt.matched);
    const newStatus = newRemaining <= 0n ? 'depleted' : 'active';
    await db
      .update(matchPools)
      .set({
        remainingMinor: newRemaining.toString(),
        matchedMinor: newMatched.toString(),
        status: newStatus as 'active' | 'depleted',
        version: sql`${matchPools.version} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(matchPools.id, params.poolId), eq(matchPools.version, pool.version)));

    eventBus.publish('donation.matched', {
      donationId: donation.id,
      poolId: params.poolId,
      donorName: donation.donorName,
      amountMinor: donation.amountMinor,
      matchedAmountMinor: donation.matchedAmountMinor,
      totalImpactMinor: donation.totalImpactMinor,
      status: 'matched',
      occurredAt: new Date(),
    });
    eventBus.publish('pool.updated', {
      poolId: params.poolId,
      remainingMinor: newRemaining.toString(),
      matchedMinor: newMatched.toString(),
      status: newStatus,
      occurredAt: new Date(),
    });

    return donation;
  },

  async listDonations(poolId?: string): Promise<Donation[]> {
    if (poolId) {
      return db
        .select()
        .from(donations)
        .where(eq(donations.poolId, poolId))
        .orderBy(desc(donations.createdAt))
        .limit(50);
    }
    return db.select().from(donations).orderBy(desc(donations.createdAt)).limit(50);
  },

  async getPoolStats(): Promise<{
    totalDonors: number;
    totalDonatedMinor: string;
    totalMatchedMinor: string;
    totalImpactMinor: string;
    activePools: number;
  }> {
    const matched = await db.select().from(donations).where(eq(donations.status, 'matched'));
    const active = await db.select().from(matchPools).where(eq(matchPools.status, 'active'));

    let totalDonated = 0n;
    let totalMatched = 0n;
    const donors = new Set<string>();
    for (const d of matched) {
      totalDonated += BigInt(d.amountMinor);
      totalMatched += BigInt(d.matchedAmountMinor);
      donors.add(d.donorPublicKey);
    }
    return {
      totalDonors: donors.size,
      totalDonatedMinor: totalDonated.toString(),
      totalMatchedMinor: totalMatched.toString(),
      totalImpactMinor: (totalDonated + totalMatched).toString(),
      activePools: active.length,
    };
  },

  /** Public interaction stats — real wallet sessions + on-chain entity counts. */
  async getInteractionStats(): Promise<{
    uniqueWallets: number;
    logins: number;
    pools: number;
    donations: number;
    totalMatchedMinor: string;
    totalImpactMinor: string;
    onChainTxs: number;
    poolBalanceXlm: string;
  }> {
    const allSessions = await db.select().from(sessions);
    const realSessions = allSessions.filter((s) => !DEMO_KEYS.has(s.publicKey));
    const wallets = new Set(realSessions.map((s) => s.publicKey));

    const allPools = await db.select().from(matchPools);
    const matched = await db.select().from(donations).where(eq(donations.status, 'matched'));

    let totalMatched = 0n;
    let totalImpact = 0n;
    let onChainTxs = 0;
    for (const d of matched) {
      totalMatched += BigInt(d.matchedAmountMinor);
      totalImpact += BigInt(d.totalImpactMinor);
      if (d.horizonTxHash) onChainTxs += 1;
    }
    // Each seeded/created pool was funded by one on-chain fund_pool tx.
    for (const p of allPools) {
      if (p.fundTxHash) onChainTxs += 1;
    }

    return {
      uniqueWallets: wallets.size,
      logins: realSessions.length,
      pools: allPools.length,
      donations: matched.length,
      totalMatchedMinor: totalMatched.toString(),
      totalImpactMinor: totalImpact.toString(),
      onChainTxs,
      poolBalanceXlm: await (async () => {
        try {
          const stroops = BigInt(await readPoolBalanceStroops());
          return (Number(stroops) / 1e7).toFixed(4);
        } catch {
          return '0.0000';
        }
      })(),
    };
  },
};

// System / issuer addresses excluded from interaction stats.
const DEMO_KEYS = new Set<string>([
  'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
  'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
]);

export { formatAmount };
