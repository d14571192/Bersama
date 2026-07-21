'use client';

/**
 * Client wallet helpers built on @stellar/freighter-api v6.
 *
 * The signing network passphrase is ALWAYS pinned to the app's configured
 * network (NEXT_PUBLIC_STELLAR_NETWORK → testnet), never the wallet's active
 * network. Connecting therefore works even if Freighter is on Mainnet.
 */
import {
  getAddress,
  isConnected,
  requestAccess,
  signTransaction,
} from '@stellar/freighter-api';

const PASSPHRASES: Record<string, string> = {
  testnet: 'Test SDF Network ; September 2015',
  public: 'Public Global Stellar Network ; September 2015',
  futurenet: 'Test SDF Future Network ; October 2022',
};

export const NETWORK = (process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'public').toLowerCase();
export const NETWORK_PASSPHRASE = PASSPHRASES[NETWORK] ?? PASSPHRASES.testnet;

export class WalletError extends Error {}

export async function freighterInstalled(): Promise<boolean> {
  try {
    const res = await isConnected();
    return typeof res === 'object' ? !!res.isConnected : !!res;
  } catch {
    return false;
  }
}

/** Prompt the user and return their public key. */
export async function requestPublicKey(): Promise<string> {
  if (!(await freighterInstalled())) {
    throw new WalletError(
      'Freighter wallet not detected. Install the Freighter extension to connect.',
    );
  }
  const res = await requestAccess();
  if (typeof res === 'object' && 'error' in res && res.error) {
    throw new WalletError(String(res.error));
  }
  const address = typeof res === 'object' && 'address' in res ? res.address : (res as unknown as string);
  if (!address) throw new WalletError('Wallet did not return an address.');
  return address;
}

export async function currentAddress(): Promise<string | null> {
  try {
    const res = await getAddress();
    const address = typeof res === 'object' && 'address' in res ? res.address : (res as unknown as string);
    return address || null;
  } catch {
    return null;
  }
}

/** Sign an XDR pinned to the app network. Returns the signed XDR string. */
export async function signXdr(xdr: string, address: string): Promise<string> {
  const res = await signTransaction(xdr, {
    networkPassphrase: NETWORK_PASSPHRASE,
    address,
  });
  if (typeof res === 'string') return res;
  if (res && typeof res === 'object') {
    if ('error' in res && res.error) throw new WalletError(String(res.error));
    if ('signedTxXdr' in res && res.signedTxXdr) return res.signedTxXdr as string;
  }
  throw new WalletError('Wallet did not return a signed transaction.');
}

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!json.ok) throw new WalletError(json.error?.message ?? `Request to ${path} failed`);
  return json.data as T;
}

/** Full SEP-10 connect: requestAccess → challenge → sign → verify. */
export async function connectWallet(): Promise<string> {
  const publicKey = await requestPublicKey();
  const { txXdr } = await api<{ txXdr: string }>('/api/auth/challenge', { publicKey });
  const signedNonce = await signXdr(txXdr, publicKey);
  await api('/api/auth/verify', { publicKey, signedNonce });
  return publicKey;
}

export async function fetchSession(): Promise<string | null> {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) return null;
    const json = await res.json();
    return json.ok ? (json.data.publicKey as string) : null;
  } catch {
    return null;
  }
}

export async function disconnectWallet(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' });
}

/** Enable USDC (changeTrust) for the connected wallet. */
export async function enableUsdc(address: string): Promise<string> {
  const { xdr } = await api<{ xdr: string }>('/api/trustline/prepare', {});
  const signedXdr = await signXdr(xdr, address);
  const { hash } = await api<{ hash: string }>('/api/trustline', { signedXdr });
  return hash;
}
