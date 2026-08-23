'use client';

import { ArrowRight, Plus, Sprout } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import { explorerAccount, formatAmount, formatAmountWithAsset, truncateKey } from '@/lib/assets';

interface Pool {
  id: string;
  causeName: string;
  causeDescription: string;
  sponsorName: string;
  asset: string;
  causePublicKey: string;
  remainingMinor: string;
  totalFundedMinor: string;
  matchedMinor: string;
  status: string;
}

export default function CausesPage() {
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/pools')
      .then((r) => r.json())
      .then((d) => d.ok && setPools(d.data.pools))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen">
      <Nav />
      <div className="mx-auto max-w-5xl px-4 pb-20 pt-28 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-4xl font-600 tracking-tight text-ink-900">Causes</h1>
            <p className="mt-2 text-ink-600">
              Sponsor-funded match pools. Give to any cause and the Match Pool contract doubles it 1:1.
            </p>
          </div>
          <Link
            href="/causes/new"
            className="inline-flex items-center gap-2 rounded-xl bg-bloom-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-bloom-700"
          >
            <Plus className="h-4 w-4" /> Open a cause
          </Link>
        </div>

        {loading ? (
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-48 animate-pulse rounded-2xl bg-ink-100" />
            ))}
          </div>
        ) : pools.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-dashed border-ink-200 bg-paper-soft px-6 py-20 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-bloom-50 text-bloom-500">
              <Sprout className="h-7 w-7" />
            </div>
            <p className="mt-4 font-semibold text-ink-800">No causes yet</p>
            <p className="mt-1 text-sm text-ink-500">Be the first sponsor and open a match pool.</p>
            <Link
              href="/causes/new"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-bloom-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-bloom-700"
            >
              <Plus className="h-4 w-4" /> Open the first cause
            </Link>
          </div>
        ) : (
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {pools.map((p) => {
              const funded = Number(p.totalFundedMinor);
              const pct = funded > 0 ? Math.round((Number(p.matchedMinor) / funded) * 100) : 0;
              const active = p.status === 'active';
              return (
                <div
                  key={p.id}
                  className="flex flex-col rounded-2xl border border-ink-100 bg-paper p-6 shadow-soft"
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded-md bg-ink-50 px-2 py-1 text-xs font-semibold text-ink-600">
                      {p.asset} match
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
                        active ? 'bg-leaf-50 text-leaf-700' : 'bg-ink-100 text-ink-500'
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-ink-900">{p.causeName}</h3>
                  <p className="mt-1.5 line-clamp-2 text-sm text-ink-500">{p.causeDescription}</p>

                  <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                    <Metric label="Funded" value={formatAmount(p.totalFundedMinor)} />
                    <Metric label="Matched" value={formatAmount(p.matchedMinor)} accent />
                    <Metric label="Left" value={formatAmount(p.remainingMinor)} />
                  </div>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-ink-100">
                    <div className="h-full rounded-full leaf-gradient" style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <a
                      href={explorerAccount(p.causePublicKey)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-ink-400 hover:text-bloom-600"
                    >
                      payout {truncateKey(p.causePublicKey)}
                    </a>
                    <span className="text-xs text-ink-400">by {p.sponsorName}</span>
                  </div>

                  {active && (
                    <Link
                      href={`/donate?poolId=${p.id}`}
                      className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-bloom-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-bloom-700"
                    >
                      Give &amp; get matched <ArrowRight className="h-4 w-4" />
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-xs text-ink-400">{label}</div>
      <div className={`font-semibold ${accent ? 'text-leaf-600' : 'text-ink-900'}`}>{value}</div>
    </div>
  );
}
