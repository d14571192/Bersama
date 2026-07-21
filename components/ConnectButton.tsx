'use client';

import { LogOut, Wallet } from 'lucide-react';
import { useState } from 'react';
import { truncateKey } from '@/lib/assets';
import { useWallet } from '@/components/WalletProvider';

export function ConnectButton({ compact = false }: { compact?: boolean }) {
  const { address, connect, disconnect, connecting, ready } = useWallet();
  const [menu, setMenu] = useState(false);

  if (!ready) {
    return <div className="h-9 w-28 rounded-lg bg-ink-100 animate-pulse" aria-hidden />;
  }

  if (address) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenu((m) => !m)}
          className="inline-flex items-center gap-2 rounded-lg border border-ink-200 bg-paper px-3 py-2 text-sm font-medium text-ink-800 hover:border-bloom-400 transition-colors"
        >
          <span className="h-2 w-2 rounded-full bg-bloom-500" />
          <span className="font-mono">{truncateKey(address)}</span>
        </button>
        {menu && (
          <div className="absolute right-0 mt-2 w-44 rounded-xl border border-ink-200 bg-paper p-1 shadow-lift z-50">
            <button
              type="button"
              onClick={async () => {
                setMenu(false);
                await disconnect();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-700 hover:bg-ink-50"
            >
              <LogOut className="h-4 w-4" />
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={connect}
      disabled={connecting}
      className="inline-flex items-center gap-2 rounded-lg bg-bloom-600 px-4 py-2 text-sm font-semibold text-white hover:bg-bloom-700 transition-colors disabled:opacity-60"
    >
      <Wallet className="h-4 w-4" />
      {connecting ? 'Connecting…' : compact ? 'Connect' : 'Connect wallet'}
    </button>
  );
}
