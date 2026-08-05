/**
 * Classic (non-Soroban) Stellar helpers — only the USDC opt-in trustline lives
 * here. All value movement for donations/matches goes through the Match Pool
 * Soroban contract (see ./matchPool.ts); this file keeps the one-tap
 * "Enable USDC" changeTrust path that lets a wallet receive USDC if it wants to.
 */
import { BASE_FEE, Operation, TransactionBuilder } from '@stellar/stellar-sdk';
import { AppError } from '@/server/lib/http';
import { assetFor } from './assets';
import { horizon, network } from './network';

/** Build an unsigned changeTrust XDR (USDC) for `source`. */
export async function buildTrustlineXdr(source: string): Promise<string> {
  let account: Awaited<ReturnType<typeof horizon.loadAccount>>;
  try {
    account = await horizon.loadAccount(source);
  } catch {
    throw new AppError(
      'INVALID_INPUT',
      'Your wallet account is not funded on testnet yet. Fund it with friendbot and retry.',
      400,
    );
  }
  return new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: network.passphrase,
  })
    .addOperation(Operation.changeTrust({ asset: assetFor('USDC') }))
    .setTimeout(180)
    .build()
    .toXDR();
}

/** Submit an already-signed classic transaction (e.g. a trustline). Returns its hash. */
export async function submitClassicXdr(signedXdr: string): Promise<string> {
  let tx: ReturnType<typeof TransactionBuilder.fromXDR>;
  try {
    tx = TransactionBuilder.fromXDR(signedXdr, network.passphrase);
  } catch {
    throw new AppError('INVALID_INPUT', 'Could not decode the signed transaction.', 400);
  }
  try {
    const res = await horizon.submitTransaction(tx);
    return res.hash;
  } catch (err) {
    const codes = extractResultCodes(err);
    throw new AppError(
      'INTERNAL',
      `Horizon rejected the transaction (${codes.join(', ') || 'unknown'}).`,
      502,
    );
  }
}

function extractResultCodes(err: unknown): string[] {
  const codes: string[] = [];
  const data = (
    err as {
      response?: { data?: { extras?: { result_codes?: { transaction?: string; operations?: string[] } } } };
    }
  )?.response?.data?.extras?.result_codes;
  if (data?.transaction) codes.push(data.transaction);
  if (data?.operations) codes.push(...data.operations);
  return codes;
}
