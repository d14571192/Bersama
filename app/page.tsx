'use client';

import {
  ArrowRight,
  ArrowUpRight,
  HandHeart,
  Sparkles,
  Sprout,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
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

interface FeedItem {
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

interface Stats {
  pools: number;
  donations: number;
  totalMatchedMinor: string;
  totalImpactMinor: string;
  onChainTxs: number;
  uniqueWallets: number;
}

interface Pool {
  id: string;
  causeName: string;
  causeDescription: string;
  sponsorName: string;
  asset: string;
  remainingMinor: string;
  totalFundedMinor: string;
  matchedMinor: string;
  status: string;
}

export default function HomePage() {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [pools, setPools] = useState<Pool[]>([]);

  const loadStats = () =>
    fetch('/api/stats')
      .then((r) => r.json())
      .then((d) => d.ok && setStats(d.data))
      .catch(() => {});

  useEffect(() => {
    loadStats();
    fetch('/api/pools')
      .then((r) => r.json())
      .then((d) => d.ok && setPools(d.data.pools))
      .catch(() => {});
    fetch('/api/donations')
      .then((r) => r.json())
      .then((d) => d.ok && setFeed(d.data.donations.slice(0, 12)))
      .catch(() => {});

    const es = new EventSource('/api/sse');
    es.addEventListener('donation.matched', (e) => {
      const item = JSON.parse((e as MessageEvent).data);
      setFeed((prev) =>
        [{ ...item, id: item.donationId, createdAt: new Date().toISOString() }, ...prev].slice(0, 12),
      );
      loadStats();
    });
    return () => es.close();
  }, []);

  const activePools = pools.filter((p) => p.status === 'active');
  const impact = stats ? formatAmount(stats.totalImpactMinor) : '0.00';

  return (
    <div className="min-h-screen">
      <Nav />

      {/* Hero */}
      <section className="grain border-b border-ink-100">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 pb-16 pt-28 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:pt-32">
          <div className="flex flex-col justify-center">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-bloom-200 bg-bloom-50 px-3 py-1 text-sm font-medium text-bloom-700">
              <Sparkles className="h-3.5 w-3.5" />
              On-chain 1:1 matching · Stellar mainnet
            </span>
            <h1 className="mt-6 font-display text-5xl font-600 leading-[1.05] tracking-tight text-ink-900 sm:text-6xl">
              Every gift,{' '}
              <span className="italic text-bloom-600">doubled</span> the moment you give.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-600">
              Bersama pairs your donation with a sponsor&apos;s on-chain match fund. You give XLM, and
              a Soroban smart contract pays the cause your gift plus a 1:1 match in the same atomic
              transaction — one doubled, provable impact.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/donate"
                className="inline-flex items-center gap-2 rounded-xl bg-bloom-600 px-6 py-3.5 font-semibold text-white shadow-lift transition-colors hover:bg-bloom-700"
              >
                <HandHeart className="h-5 w-5" />
                Give &amp; double it
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/causes"
                className="inline-flex items-center gap-2 rounded-xl border border-ink-200 bg-paper px-6 py-3.5 font-semibold text-ink-800 transition-colors hover:border-ink-300"
              >
                Browse causes
              </Link>
            </div>
            <dl className="mt-10 grid max-w-md grid-cols-3 gap-4">
              <Stat label="Doubled impact" value={impact} unit="given + matched" />
              <Stat label="On-chain txs" value={`${stats?.onChainTxs ?? 0}`} unit="settled" />
              <Stat label="Active causes" value={`${activePools.length}`} unit="open now" />
            </dl>
          </div>

          {/* Live match feed */}
          <div className="lg:pt-2">
            <div className="overflow-hidden rounded-3xl border border-ink-100 bg-paper shadow-lift">
              <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-leaf-500 live-dot" />
                  <span className="text-sm font-semibold text-ink-800">Live match feed</span>
                </div>
                <span className="text-xs text-ink-400">real on-chain matches</span>
              </div>
              <div className="max-h-[460px] divide-y divide-ink-100 overflow-y-auto">
                {feed.length === 0 ? (
                  <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bloom-50 text-bloom-400">
                      <Sprout className="h-6 w-6" />
                    </div>
                    <p className="mt-4 text-sm font-medium text-ink-700">No gifts yet</p>
                    <p className="mt-1 text-sm text-ink-400">
                      Be the first — your match settles on-chain in seconds.
                    </p>
                  </div>
                ) : (
                  feed.map((it) => (
                    <div key={it.id} className="rise px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-mono text-sm text-ink-800">{truncateKey(it.donorName)}</p>
                          <p className="mt-0.5 text-xs text-ink-500">
                            gave {formatAmountWithAsset(it.amountMinor, it.asset)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-leaf-600">
                            +{formatAmount(it.matchedAmountMinor)} matched
                          </p>
                          <p className="text-xs text-ink-400">{timeAgo(it.createdAt)}</p>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="rounded-md bg-leaf-50 px-2 py-0.5 text-xs font-semibold text-leaf-700">
                          {formatAmountWithAsset(it.totalImpactMinor, it.asset)} total impact
                        </span>
                        {it.horizonTxHash && (
                          <a
                            href={explorerTx(it.horizonTxHash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-ink-400 hover:text-bloom-600"
                          >
                            tx <ArrowUpRight className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Active causes */}
      {activePools.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <h2 className="font-display text-3xl font-600 text-ink-900">Causes matching now</h2>
              <p className="mt-1 text-ink-500">Sponsor-funded pools ready to double your gift.</p>
            </div>
            <Link
              href="/causes"
              className="hidden text-sm font-semibold text-bloom-600 hover:text-bloom-700 sm:block"
            >
              View all causes →
            </Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {activePools.slice(0, 3).map((p) => (
              <CauseCard key={p.id} pool={p} />
            ))}
          </div>
        </section>
      )}

      {/* How it works */}
      <section className="border-y border-ink-100 bg-paper-soft">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-center font-display text-3xl font-600 text-ink-900">
            How a doubled gift works
          </h2>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {[
              {
                icon: Sprout,
                step: '01',
                title: 'A sponsor opens a cause',
                desc: 'Anyone can lock a match pool into the Soroban contract and name the cause + payout address it supports.',
              },
              {
                icon: Wallet,
                step: '02',
                title: 'You give on-chain',
                desc: 'Connect Freighter, choose an amount in XLM, and sign one Soroban invoke that calls the Match Pool contract.',
              },
              {
                icon: HandHeart,
                step: '03',
                title: 'The pool matches 1:1',
                desc: 'The Match Pool contract pays the cause your gift plus an equal match from the sponsor pool — same atomic transaction, fully provable.',
              },
            ].map((f) => (
              <div key={f.step} className="rounded-2xl border border-ink-100 bg-paper p-6 shadow-soft">
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-bloom-50 text-bloom-600">
                    <f.icon className="h-5 w-5" />
                  </span>
                  <span className="font-display text-2xl font-600 text-ink-200">{f.step}</span>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-ink-900">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div>
      <dd className="font-display text-2xl font-600 tnum text-ink-900">{value}</dd>
      <dt className="text-xs font-medium text-ink-500">{label}</dt>
      <dt className="text-[11px] text-ink-400">{unit}</dt>
    </div>
  );
}

function CauseCard({ pool }: { pool: Pool }) {
  const funded = Number(pool.totalFundedMinor);
  const pct = funded > 0 ? Math.round((Number(pool.matchedMinor) / funded) * 100) : 0;
  return (
    <div className="flex flex-col rounded-2xl border border-ink-100 bg-paper p-6 shadow-soft transition-shadow hover:shadow-lift">
      <div className="flex items-center justify-between">
        <span className="rounded-md bg-ink-50 px-2 py-1 text-xs font-semibold text-ink-600">
          {pool.asset} match
        </span>
        <span className="rounded-full bg-leaf-50 px-2.5 py-1 text-xs font-semibold text-leaf-700">
          Active
        </span>
      </div>
      <h3 className="mt-4 text-lg font-semibold text-ink-900">{pool.causeName}</h3>
      <p className="mt-1.5 line-clamp-2 text-sm text-ink-500">{pool.causeDescription}</p>
      <div className="mt-4">
        <div className="flex justify-between text-sm">
          <span className="text-ink-500">Match left</span>
          <span className="font-semibold text-leaf-600">
            {formatAmountWithAsset(pool.remainingMinor, pool.asset)}
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-ink-100">
          <div className="h-full rounded-full leaf-gradient" style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
      </div>
      <p className="mt-3 text-xs text-ink-400">by {pool.sponsorName}</p>
      <Link
        href={`/donate?poolId=${pool.id}`}
        className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-bloom-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-bloom-700"
      >
        Give &amp; get matched <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
