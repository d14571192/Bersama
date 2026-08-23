'use client';

import { Activity, ArrowUpRight, Coins, HandHeart, Link2, Users, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import {
  explorerTx,
  formatAmount,
  formatAmountWithAsset,
  timeAgo,
  truncateKey,
} from '@/lib/assets';

interface Stats {
  uniqueWallets: number;
  logins: number;
  pools: number;
  donations: number;
  totalMatchedMinor: string;
  totalImpactMinor: string;
  onChainTxs: number;
  poolBalanceXlm: string;
}

interface Donation {
  id: string;
  donorName: string;
  asset: string;
  amountMinor: string;
  matchedAmountMinor: string;
  totalImpactMinor: string;
  horizonTxHash?: string | null;
  matchTxHash?: string | null;
  createdAt: string;
}

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () => {
      fetch('/api/stats')
        .then((r) => r.json())
        .then((d) => d.ok && setStats(d.data))
        .catch(() => {});
      fetch('/api/donations')
        .then((r) => r.json())
        .then((d) => d.ok && setDonations(d.data.donations))
        .catch(() => {})
        .finally(() => setLoading(false));
    };
    load();
    const es = new EventSource('/api/sse');
    es.addEventListener('donation.matched', load);
    return () => es.close();
  }, []);

  const cards = [
    { icon: Wallet, label: 'Unique wallets', value: stats?.uniqueWallets ?? 0, sub: 'connected via SEP-10' },
    { icon: Users, label: 'Wallet logins', value: stats?.logins ?? 0, sub: 'auth sessions' },
    { icon: HandHeart, label: 'Gifts matched', value: stats?.donations ?? 0, sub: 'completed donations' },
    { icon: Activity, label: 'Causes', value: stats?.pools ?? 0, sub: 'match pools opened' },
    { icon: Link2, label: 'On-chain txs', value: stats?.onChainTxs ?? 0, sub: 'gifts + matches settled' },
    {
      icon: Coins,
      label: 'Pool balance (on-chain)',
      value: stats ? `${stats.poolBalanceXlm} XLM` : '0.0000 XLM',
      sub: 'XLM held by pool contract',
    },
  ];

  return (
    <div className="min-h-screen">
      <Nav />
      <div className="mx-auto max-w-5xl px-4 pb-20 pt-28 sm:px-6">
        <h1 className="font-display text-4xl font-600 tracking-tight text-ink-900">Community impact</h1>
        <p className="mt-2 text-ink-600">
          Real interactions on Bersama — wallet sessions and on-chain entities, demo keys excluded.
        </p>

        {/* Doubled impact banner */}
        <div className="mt-8 overflow-hidden rounded-3xl bloom-gradient p-8 text-white shadow-lift">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm text-white/80">Total doubled impact (gifts + matches)</p>
              <p className="mt-1 font-display text-5xl font-600 tnum">
                {stats ? formatAmount(stats.totalImpactMinor) : '0.00'}
              </p>
            </div>
            <div className="text-sm text-white/80">
              of which{' '}
              <span className="font-semibold text-white">
                {stats ? formatAmount(stats.totalMatchedMinor) : '0.00'}
              </span>{' '}
              matched on-chain by the pool
            </div>
          </div>
        </div>

        {/* Metric cards */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {cards.map((c) => (
            <div key={c.label} className="rounded-2xl border border-ink-100 bg-paper p-5 shadow-soft">
              <c.icon className="h-5 w-5 text-bloom-500" />
              <div className="mt-3 font-display text-3xl font-600 tnum text-ink-900">{c.value}</div>
              <div className="mt-0.5 text-xs font-medium text-ink-700">{c.label}</div>
              <div className="text-[11px] text-ink-400">{c.sub}</div>
            </div>
          ))}
        </div>

        {/* Recent activity */}
        <div className="mt-10 overflow-hidden rounded-2xl border border-ink-100 bg-paper shadow-soft">
          <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
            <h2 className="font-semibold text-ink-900">Recent matches</h2>
            <span className="flex items-center gap-1.5 text-xs text-ink-400">
              <span className="h-2 w-2 rounded-full bg-leaf-500 live-dot" /> live
            </span>
          </div>
          {loading ? (
            <div className="space-y-px">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 animate-pulse bg-ink-50" />
              ))}
            </div>
          ) : donations.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-ink-400">
              No matched gifts yet. Be the first to give.
            </div>
          ) : (
            <div className="divide-y divide-ink-100">
              {donations.map((d) => (
                <div key={d.id} className="flex items-center justify-between px-6 py-4">
                  <div className="min-w-0">
                    <p className="font-mono text-sm text-ink-800">{truncateKey(d.donorName)}</p>
                    <p className="text-xs text-ink-400">{timeAgo(d.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-ink-900">
                        {formatAmountWithAsset(d.amountMinor, d.asset)}
                      </p>
                      <p className="text-xs font-semibold text-leaf-600">
                        +{formatAmount(d.matchedAmountMinor)} matched
                      </p>
                    </div>
                    {d.horizonTxHash && (
                      <a
                        href={explorerTx(d.horizonTxHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-ink-300 hover:text-bloom-600"
                        aria-label="View transaction"
                      >
                        <ArrowUpRight className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
