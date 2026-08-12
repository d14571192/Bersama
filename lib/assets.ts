/**
 * Asset + amount helpers shared by client and server.
 * All Stellar amounts use 7 decimal places (stroops). We store integer
 * "stroop strings" in the DB and convert to/from human display here.
 */

export type AssetCode = 'XLM' | 'USDC';

export const ASSET_CODES: AssetCode[] = ['XLM', 'USDC'];

export const STROOPS_PER_UNIT = 10_000_000n; // 7 decimals

export interface AssetMeta {
  code: AssetCode;
  label: string;
  /** true for the native asset (no trustline required) */
  native: boolean;
  hint: string;
}

export const ASSETS: Record<AssetCode, AssetMeta> = {
  XLM: {
    code: 'XLM',
    label: 'XLM',
    native: true,
    hint: 'Native asset · works for any funded wallet, no trustline',
  },
  USDC: {
    code: 'USDC',
    label: 'USDC',
    native: false,
    hint: 'Stablecoin · requires a one-tap trustline',
  },
};

export function isAssetCode(v: string): v is AssetCode {
  return v === 'XLM' || v === 'USDC';
}

/** Convert a human decimal string ("12.5") to a stroop string ("125000000"). */
export function toStroops(display: string): string {
  const trimmed = display.trim();
  if (!/^\d+(\.\d{1,7})?$/.test(trimmed)) {
    throw new Error('Invalid amount');
  }
  const [whole, frac = ''] = trimmed.split('.');
  const fracPadded = frac.padEnd(7, '0').slice(0, 7);
  return (BigInt(whole) * STROOPS_PER_UNIT + BigInt(fracPadded)).toString();
}

/** Convert a stroop string to the SDK payment amount string ("12.5000000"). */
export function stroopsToSdkAmount(stroops: string): string {
  const n = BigInt(stroops);
  const whole = n / STROOPS_PER_UNIT;
  const frac = (n % STROOPS_PER_UNIT).toString().padStart(7, '0');
  return `${whole}.${frac}`;
}

/** Pretty display: "12.50" (trims trailing zeros, keeps >= 2 decimals). */
export function formatAmount(stroops: string): string {
  const n = BigInt(stroops);
  const whole = n / STROOPS_PER_UNIT;
  const frac = (n % STROOPS_PER_UNIT).toString().padStart(7, '0');
  let trimmed = frac.replace(/0+$/, '');
  if (trimmed.length < 2) trimmed = trimmed.padEnd(2, '0');
  return `${whole.toString()}.${trimmed}`;
}

/** "12.50 XLM" */
export function formatAmountWithAsset(stroops: string, asset: string): string {
  return `${formatAmount(stroops)} ${asset}`;
}

export function truncateKey(key: string): string {
  if (!key || key.length <= 12) return key;
  return `${key.slice(0, 5)}…${key.slice(-5)}`;
}

const NETWORK = (process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'public').toLowerCase();
const EXPLORER_NET = NETWORK === 'public' ? 'public' : 'testnet';

export function explorerTx(hash: string): string {
  return `https://stellar.expert/explorer/${EXPLORER_NET}/tx/${hash}`;
}

export function explorerAccount(key: string): string {
  return `https://stellar.expert/explorer/${EXPLORER_NET}/account/${key}`;
}

export function timeAgo(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
