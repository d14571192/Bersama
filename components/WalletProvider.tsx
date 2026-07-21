'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  connectWallet,
  disconnectWallet,
  enableUsdc,
  fetchSession,
} from '@/lib/wallet';

interface WalletState {
  address: string | null;
  connecting: boolean;
  ready: boolean;
  error: string | null;
  connect: () => Promise<string | null>;
  disconnect: () => Promise<void>;
  enableUsdcTrust: () => Promise<string | null>;
}

const WalletContext = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore session on mount
  useEffect(() => {
    fetchSession()
      .then((pk) => setAddress(pk))
      .finally(() => setReady(true));
  }, []);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const pk = await connectWallet();
      setAddress(pk);
      return pk;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not connect wallet';
      setError(msg);
      return null;
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    await disconnectWallet();
    setAddress(null);
  }, []);

  const enableUsdcTrust = useCallback(async () => {
    if (!address) {
      setError('Connect your wallet first');
      return null;
    }
    setError(null);
    try {
      return await enableUsdc(address);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not enable USDC');
      return null;
    }
  }, [address]);

  return (
    <WalletContext.Provider
      value={{ address, connecting, ready, error, connect, disconnect, enableUsdcTrust }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
}
