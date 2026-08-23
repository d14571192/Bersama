import { StrKey } from '@stellar/stellar-sdk';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { toStroops } from '@/lib/assets';
import { AppError, created, ok } from '@/server/lib/http';
import {
  buildDonateXdr,
  buildFundPoolXdr,
  buildTrustlineXdr,
  newPoolKey,
  submitClassicXdr,
  USDC_ISSUER,
} from '@/server/stellar';
import { matchPoolService } from '@/server/service/matchPool.service';

const gAddress = z
  .string()
  .refine((v) => v.length === 56 && StrKey.isValidEd25519PublicKey(v), 'Invalid Stellar address');

const amountStr = z.string().regex(/^\d+(\.\d{1,7})?$/, 'Invalid amount');
const hex64 = z.string().regex(/^[0-9a-f]{64}$/, 'Invalid pool key');

const poolMeta = {
  sponsorName: z.string().min(1).max(100),
  causeName: z.string().min(1).max(100),
  causeDescription: z.string().min(1).max(500),
  causePublicKey: gAddress,
};

const preparePoolSchema = z.object({ ...poolMeta, matchFund: amountStr });
const confirmPoolSchema = z.object({
  ...poolMeta,
  poolKey: hex64,
  signedXdr: z.string().min(1),
});

const prepareSchema = z.object({
  poolId: z.string().uuid(),
  amount: amountStr,
  memo: z.string().max(28).optional(),
});
const confirmSchema = z.object({
  poolId: z.string().uuid(),
  signedXdr: z.string().min(1),
  memo: z.string().max(28).optional(),
});

function requireWallet(ctx: { publicKey?: string }): string {
  if (!ctx.publicKey) throw new AppError('UNAUTHORIZED', 'Connect your wallet to continue', 401);
  return ctx.publicKey;
}

// ── Pools ──────────────────────────────────────────────────────────────

export async function listPools(_req: NextRequest) {
  return ok({ pools: await matchPoolService.listPools() });
}

/** Build the sponsor-signed `fund_pool` invoke that locks the match on-chain. */
export async function preparePool(req: NextRequest, ctx: { publicKey?: string }) {
  const sponsor = requireWallet(ctx);
  const body = preparePoolSchema.parse(await req.json());
  if (parseFloat(body.matchFund) <= 0) {
    throw new AppError('INVALID_INPUT', 'Match fund must be greater than zero', 400);
  }
  const poolKey = newPoolKey();
  const xdr = await buildFundPoolXdr({
    sponsor,
    poolKey,
    cause: body.causePublicKey,
    stroops: toStroops(body.matchFund),
  });
  return ok({ xdr, poolKey });
}

/** Submit the signed `fund_pool` and persist the pool. */
export async function createPool(req: NextRequest, ctx: { publicKey?: string }) {
  const sponsor = requireWallet(ctx);
  const body = confirmPoolSchema.parse(await req.json());
  const pool = await matchPoolService.confirmPool({
    sponsorPublicKey: sponsor,
    sponsorName: body.sponsorName,
    causeName: body.causeName,
    causeDescription: body.causeDescription,
    causePublicKey: body.causePublicKey,
    poolKey: body.poolKey,
    signedXdr: body.signedXdr,
  });
  return created({ pool });
}

export async function getPool(
  _req: NextRequest,
  ctx: { params?: Promise<Record<string, string | string[] | undefined>> },
) {
  const params = await ctx.params;
  const id = params?.id as string;
  if (!z.string().uuid().safeParse(id).success) {
    throw new AppError('NOT_FOUND', 'Match pool not found', 404);
  }
  return ok({ pool: await matchPoolService.getPool(id) });
}

// ── Donations ───────────────────────────────────────────────────────────

/** Build an unsigned `donate` invoke for the donor's wallet to sign. */
export async function prepareDonation(req: NextRequest, ctx: { publicKey?: string }) {
  const donor = requireWallet(ctx);
  const body = prepareSchema.parse(await req.json());
  if (parseFloat(body.amount) <= 0) {
    throw new AppError('INVALID_INPUT', 'Donation amount must be greater than zero', 400);
  }
  const pool = await matchPoolService.getPool(body.poolId);
  if (pool.status !== 'active') throw new AppError('CONFLICT', 'This pool is no longer active', 409);

  const xdr = await buildDonateXdr({
    donor,
    poolKey: pool.poolKey,
    stroops: toStroops(body.amount),
  });
  return ok({ xdr, destination: pool.causePublicKey });
}

/** Submit the signed `donate` invoke (atomic gift + match) and persist it. */
export async function confirmDonation(req: NextRequest, ctx: { publicKey?: string }) {
  const donor = requireWallet(ctx);
  const body = confirmSchema.parse(await req.json());
  const donation = await matchPoolService.confirmDonation({
    poolId: body.poolId,
    donorPublicKey: donor,
    signedXdr: body.signedXdr,
    memo: body.memo,
  });
  return created({ donation });
}

export async function listDonations(req: NextRequest) {
  const url = new URL(req.url);
  const poolId = url.searchParams.get('poolId') ?? undefined;
  return ok({ donations: await matchPoolService.listDonations(poolId) });
}

// ── Trustline (Enable USDC opt-in) ───────────────────────────────────────

export async function prepareTrustline(_req: NextRequest, ctx: { publicKey?: string }) {
  const wallet = requireWallet(ctx);
  const xdr = await buildTrustlineXdr(wallet);
  return ok({ xdr, issuer: USDC_ISSUER });
}

export async function confirmTrustline(req: NextRequest, ctx: { publicKey?: string }) {
  requireWallet(ctx);
  const body = z.object({ signedXdr: z.string().min(1) }).parse(await req.json());
  const hash = await submitClassicXdr(body.signedXdr);
  return ok({ hash });
}

// ── Stats ─────────────────────────────────────────────────────────────

export async function getStats(_req: NextRequest) {
  return ok({ stats: await matchPoolService.getPoolStats() });
}

export async function getInteractionStats(_req: NextRequest) {
  return ok(await matchPoolService.getInteractionStats());
}
