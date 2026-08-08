/**
 * Muxed account utilities for per-donor attribution (SEP-23).
 * MuxedAccount encodes a sequential donor ID into a base Stellar address,
 * allowing donations to be attributed per-donor on-chain.
 */
import { Account, MuxedAccount } from '@stellar/stellar-sdk';

// Base Stellar account used for muxed address generation (testnet USDC issuer)
const MUXED_BASE_KEY = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

/**
 * Format a USDC minor units string for display.
 * "200000" → "0.20", "1000000" → "1.00", "8000000" → "8.00"
 */
export function formatUsdc(amountMinor: string): string {
  const n = BigInt(amountMinor);
  const whole = n / 1_000_000n;
  const frac = n % 1_000_000n;
  const fracStr = frac.toString().padStart(6, '0').replace(/0+$/, '') || '00';
  // Show at most 2 significant decimal places for clarity
  const fracDisplay = fracStr.slice(0, 2);
  return `${whole}.${fracDisplay}`;
}

/**
 * Parse USDC display string to minor units string.
 * "200.00" → "200000000", "0.20" → "200000", "8" → "8000000"
 */
export function parseUsdc(display: string): string {
  const [whole, frac = ''] = display.split('.');
  const fracPadded = frac.padEnd(6, '0').slice(0, 6);
  return (BigInt(whole) * 1_000_000n + BigInt(fracPadded)).toString();
}

/**
 * Create a muxed account address for per-donor attribution (SEP-23).
 * Uses donor's sequential integer ID encoded in the muxed account.
 * Returns the M-prefixed muxed account address string.
 *
 * @param donorIndex - sequential donor integer ID
 * @param basePublicKey - base Stellar G-address (defaults to MUXED_BASE_KEY)
 */
export function createMuxedAddress(
  donorIndex: number,
  basePublicKey: string = MUXED_BASE_KEY
): string {
  const base = new Account(basePublicKey, '0');
  const muxed = new MuxedAccount(base, donorIndex.toString());
  return muxed.accountId();
}

/**
 * Legacy alias — returns M-prefixed muxed account address.
 * @deprecated Use createMuxedAddress() for SEP-23 compliant M-addresses.
 */
export function createMuxedId(donorIndex: number): string {
  return createMuxedAddress(donorIndex);
}
