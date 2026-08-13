import { and, desc, eq, lt, sql } from 'drizzle-orm';
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
};

function nextCursorFor(rows: { createdAt: Date }[], pageSize: number): string | null {
  if (rows.length < pageSize) return null;
  return rows[rows.length - 1].createdAt.toISOString();
}

export { formatAmount };