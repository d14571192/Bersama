/**
 * Soroban RPC submission helpers: submit a signed invoke transaction, poll to
 * finality, and surface the contract's return value. Retries the transient
 * TRY_AGAIN_LATER throttle; maps tx_bad_seq to a clear "please retry" error.
 */
import { TransactionBuilder, scValToNative, type rpc } from '@stellar/stellar-sdk';
import { AppError } from '@/server/lib/http';
import { network, soroban } from './network';

const POLL_ATTEMPTS = 30;
const POLL_INTERVAL_MS = 2000;
const SEND_RETRIES = 4;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface InvokeResult {
  hash: string;
  /** Native (JS) form of the contract's return value, or null for void. */
  returnValue: unknown;
}

/**
 * Submit a Freighter-signed invoke XDR, poll until SUCCESS, and return the tx
 * hash plus the decoded contract return value.
 */
export async function submitInvoke(signedXdr: string): Promise<InvokeResult> {
  let tx: ReturnType<typeof TransactionBuilder.fromXDR>;
  try {
    tx = TransactionBuilder.fromXDR(signedXdr, network.passphrase);
  } catch {
    throw new AppError('INVALID_INPUT', 'Could not decode the signed transaction.', 400);
  }

  // 1) Send, retrying the transient throttle.
  let sent: rpc.Api.SendTransactionResponse | undefined;
  for (let attempt = 0; attempt < SEND_RETRIES; attempt++) {
    sent = await soroban.sendTransaction(tx);
    if (sent.status === 'PENDING') break;
    if (sent.status === 'TRY_AGAIN_LATER') {
      await sleep(POLL_INTERVAL_MS);
      continue;
    }
    // ERROR / DUPLICATE
    const codes = JSON.stringify(sent.errorResult?.result() ?? sent.status);
    if (codes.includes('txBadSeq') || codes.includes('tx_bad_seq')) {
      throw new AppError('CONFLICT', 'Wallet sequence changed — please retry.', 409);
    }
    if (codes.includes('txInsufficientBalance') || codes.includes('underfunded')) {
      throw new AppError('CONFLICT', 'Insufficient balance to complete this transaction.', 409);
    }
    throw new AppError('INTERNAL', `RPC rejected the transaction (${sent.status}).`, 502);
  }
  if (!sent || sent.status !== 'PENDING') {
    throw new AppError('INTERNAL', 'RPC did not accept the transaction. Please retry.', 502);
  }

  const hash = sent.hash;

  // 2) Poll to finality.
  for (let i = 0; i < POLL_ATTEMPTS; i++) {
    const res = await soroban.getTransaction(hash);
    if (res.status === 'SUCCESS') {
      let returnValue: unknown = null;
      try {
        if (res.returnValue) returnValue = scValToNative(res.returnValue);
      } catch {
        returnValue = null;
      }
      return { hash, returnValue };
    }
    if (res.status === 'FAILED') {
      throw new AppError(
        'INTERNAL',
        'The on-chain transaction failed. No funds moved. Please retry.',
        502,
      );
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new AppError('INTERNAL', 'Timed out waiting for the transaction to settle.', 504);
}
