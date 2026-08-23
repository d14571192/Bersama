/**
 * Match Pool Soroban contract client (server side).
 *
 * Builds the unsigned `fund_pool` / `donate` invoke XDRs (simulated + assembled
 * via Soroban RPC, ready for Freighter to sign), submits the signed result, and
 * decodes the contract's return values. This is the ONLY place the app talks to
 * the matched-donation contract.
 */
import {
  Address,
  BASE_FEE,
  Contract,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk';
import { randomBytes } from 'node:crypto';
import { AppError } from '@/server/lib/http';
import { network, soroban } from './network';
import { submitInvoke } from './rpc';

function contract(): Contract {
  if (!network.matchPoolContractId) {
    throw new AppError('INTERNAL', 'Match Pool contract id is not configured.', 500);
  }
  return new Contract(network.matchPoolContractId);
}

/** A fresh random 32-byte pool key (hex), one per cause/pool. */
export function newPoolKey(): string {
  return randomBytes(32).toString('hex');
}

function poolIdScVal(poolKeyHex: string): xdr.ScVal {
  const buf = Buffer.from(poolKeyHex, 'hex');
  if (buf.length !== 32) throw new AppError('INVALID_INPUT', 'Invalid pool key.', 400);
  return nativeToScVal(buf, { type: 'bytes' });
}

const addrScVal = (g: string) => new Address(g).toScVal();
const i128ScVal = (stroops: string) => nativeToScVal(BigInt(stroops), { type: 'i128' });

/** Prepare (simulate + assemble) an invoke tx so Freighter can sign it. */
async function prepareInvoke(source: string, op: xdr.Operation): Promise<string> {
  let account: Awaited<ReturnType<typeof soroban.getAccount>>;
  try {
    account = await soroban.getAccount(source);
  } catch {
    throw new AppError(
      'INVALID_INPUT',
      'Your wallet account is not funded on testnet yet. Fund it with friendbot and retry.',
      400,
    );
  }
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: network.passphrase,
  })
    .addOperation(op)
    .setTimeout(180)
    .build();

  try {
    const prepared = await soroban.prepareTransaction(tx);
    return prepared.toXDR();
  } catch {
    throw new AppError(
      'INTERNAL',
      'Could not prepare the on-chain transaction. The contract simulation failed.',
      502,
    );
  }
}

/** Build an unsigned `fund_pool(sponsor, pool_id, cause, amount)` invoke. */
export async function buildFundPoolXdr(params: {
  sponsor: string;
  poolKey: string;
  cause: string;
  stroops: string;
}): Promise<string> {
  const op = contract().call(
    'fund_pool',
    addrScVal(params.sponsor),
    poolIdScVal(params.poolKey),
    addrScVal(params.cause),
    i128ScVal(params.stroops),
  );
  return prepareInvoke(params.sponsor, op);
}

/** Build an unsigned `donate(donor, pool_id, amount)` invoke. */
export async function buildDonateXdr(params: {
  donor: string;
  poolKey: string;
  stroops: string;
}): Promise<string> {
  const op = contract().call(
    'donate',
    addrScVal(params.donor),
    poolIdScVal(params.poolKey),
    i128ScVal(params.stroops),
  );
  return prepareInvoke(params.donor, op);
}

export interface FundResult {
  hash: string;
  totalFunded: string;
  remaining: string;
}

/** Submit a signed `fund_pool` and decode the resulting Pool. */
export async function submitFundPool(signedXdr: string): Promise<FundResult> {
  const { hash, returnValue } = await submitInvoke(signedXdr);
  const pool = returnValue as { total_funded?: bigint; remaining?: bigint } | null;
  return {
    hash,
    totalFunded: (pool?.total_funded ?? 0n).toString(),
    remaining: (pool?.remaining ?? 0n).toString(),
  };
}

export interface DonateResult {
  hash: string;
  donated: string;
  matched: string;
  total: string;
  remaining: string;
}

/** Submit a signed `donate` and decode the on-chain Receipt. */
export async function submitDonate(signedXdr: string): Promise<DonateResult> {
  const { hash, returnValue } = await submitInvoke(signedXdr);
  const r = returnValue as
    | { donated?: bigint; matched?: bigint; total?: bigint; remaining?: bigint }
    | null;
  if (!r || r.donated == null) {
    throw new AppError('INTERNAL', 'On-chain donation returned no receipt.', 502);
  }
  return {
    hash,
    donated: (r.donated ?? 0n).toString(),
    matched: (r.matched ?? 0n).toString(),
    total: (r.total ?? 0n).toString(),
    remaining: (r.remaining ?? 0n).toString(),
  };
}

// Any funded account works as the simulation source for a read-only view.
const READ_SOURCE = 'GBL5RJKF4QNJ4ZPLJZ7PS7K5A4J44VEZJRV2CRTFFDRVSY2N76AIIE47';

/** Read a pool's remaining match fund straight from the contract (view). */
export async function readPoolRemaining(poolKey: string): Promise<string | null> {
  try {
    const account = await soroban.getAccount(READ_SOURCE);
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: network.passphrase,
    })
      .addOperation(contract().call('pool_remaining', poolIdScVal(poolKey)))
      .setTimeout(60)
      .build();
    const sim = await soroban.simulateTransaction(tx);
    if ('result' in sim && sim.result?.retval) {
      return (scValToNative(sim.result.retval) as bigint).toString();
    }
  } catch {
    /* best-effort read */
  }
  return null;
}

export async function readPoolBalanceStroops(): Promise<string> {
  try {
    const account = await soroban.getAccount(READ_SOURCE);
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: network.passphrase,
    })
      .addOperation(
        new Contract(network.xlmSac).call('balance', addrScVal(network.matchPoolContractId)),
      )
      .setTimeout(60)
      .build();
    const sim = await soroban.simulateTransaction(tx);
    if ('result' in sim && sim.result?.retval) {
      return (scValToNative(sim.result.retval) as bigint).toString();
    }
  } catch {
    /* best-effort read */
  }
  return '0';
}
