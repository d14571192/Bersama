'use client';

import {
  ArrowUpRight,
  CheckCircle2,
  ChevronLeft,
  HandHeart,
  Loader2,
  Sparkles,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import { useWallet } from '@/components/WalletProvider';
import { explorerTx, formatAmount, truncateKey } from '@/lib/assets';
import { signXdr } from '@/lib/wallet';

interface Pool {
  id: string;
  causeName: string;
  causeDescription: string;
  sponsorName: string;
  asset: 'XLM' | 'USDC';
  remainingMinor: string;
  status: string;
}

interface DonationResult {
  amountMinor: string;
  matchedAmountMinor: string;
  totalImpactMinor: string;
  asset: string;
  horizonTxHash?: string | null;
  matchTxHash?: string | null;
}

function DonateForm() {
  const params = useSearchParams();
  const { address, connect, connecting, enableUsdcTrust } = useWallet();

  const [pools, setPools] = useState<Pool[]>([]);
  const [poolId, setPoolId] = useState(params.get('poolId') ?? '');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [busy, setBusy] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [result, setResult] = useState<DonationResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/pools')
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) return;
        const active = d.data.pools.filter((p: Pool) => p.status === 'active');
        setPools(active);
        setPoolId((cur) => cur || (active[0]?.id ?? ''));
      })
      .catch(() => {});
  }, []);

  const pool = useMemo(() => pools.find((p) => p.id === poolId), [pools, poolId]);
  const amountNum = parseFloat(amount) || 0;
  const valid = pool && amountNum > 0 && /^\d+(\.\d{1,7})?$/.test(amount);

  async function handleGive(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!pool) {
      setError('Pick a cause to support.');
      return;
    }
    if (amountNum <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }

    let donor = address;
    if (!donor) {
      donor = await connect();
      if (!donor) return;
    }

    setBusy(true);
    try {
      const prep = await fetch('/api/donations/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poolId: pool.id, amount, memo: memo || undefined }),
      }).then((r) => r.json());
      if (!prep.ok) throw new Error(prep.error?.message ?? 'Could not prepare donation');

      const signed = await signXdr(prep.data.xdr, donor);

      const conf = await fetch('/api/donations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poolId: pool.id, signedXdr: signed, memo: memo || undefined }),
      }).then((r) => r.json());
      if (!conf.ok) throw new Error(conf.error?.message ?? 'Donation failed');

      setResult(conf.data.donation);
      toast.success('Gift sent and matched on-chain!');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Donation failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleEnableUsdc() {
    setEnabling(true);
    const hash = await enableUsdcTrust();
    setEnabling(false);
    if (hash) toast.success('USDC enabled on your wallet');
  }

  if (result) {
    return (
      <div className="mx-auto max-w-lg rise">
        <div className="overflow-hidden rounded-3xl border border-ink-100 bg-paper shadow-lift">
          <div className="bloom-gradient px-8 py-10 text-center text-white">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/20">
              <CheckCircle2 className="h-9 w-9" />
            </div>
            <h2 className="mt-4 font-display text-3xl font-600">Doubled.</h2>
            <p className="mt-1 text-white/85">
              Your gift and its 1:1 match settled in one atomic Stellar transaction.
            </p>
          </div>
          <div className="space-y-3 p-8">
            <Row label="Your gift" value={`${formatAmount(result.amountMinor)} ${result.asset}`} />
            <Row
              label="Pool match (1:1)"
              value={`+${formatAmount(result.matchedAmountMinor)} ${result.asset}`}
              accent
            />
            <div className="flex items-center justify-between border-t border-ink-100 pt-3">
              <span className="font-semibold text-ink-900">Total impact</span>
              <span className="font-display text-2xl font-600 text-bloom-600">
                {formatAmount(result.totalImpactMinor)} {result.asset}
              </span>
            </div>
            <div className="space-y-2 pt-2">
              {result.horizonTxHash && (
                <TxLink label="On-chain tx (gift + 1:1 match)" hash={result.horizonTxHash} />
              )}
            </div>
            <div className="flex flex-col gap-2 pt-4">
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  setAmount('');
                  setMemo('');
                }}
                className="rounded-xl bg-bloom-600 py-3 font-semibold text-white transition-colors hover:bg-bloom-700"
              >
                Give again
              </button>
              <Link
                href="/stats"
                className="rounded-xl border border-ink-200 py-3 text-center text-sm font-semibold text-ink-700 hover:border-ink-300"
              >
                See community impact
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <Link
        href="/causes"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"
      >
        <ChevronLeft className="h-4 w-4" /> All causes
      </Link>
      <h1 className="font-display text-4xl font-600 tracking-tight text-ink-900">Give &amp; double it</h1>
      <p className="mt-2 text-ink-600">
        Your gift and a 1:1 match from the on-chain pool are paid to the cause together — one atomic
        Stellar transaction, settled by the Match Pool smart contract.
      </p>

      {!address && (
        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-bloom-200 bg-bloom-50 p-4">
          <Wallet className="h-5 w-5 shrink-0 text-bloom-600" />
          <p className="text-sm text-ink-700">
            You can pick a cause and amount now. We&apos;ll ask you to connect Freighter when you
            sign.
          </p>
        </div>
      )}

      {/* Live preview */}
      {amountNum > 0 && pool && (
        <div className="mt-6 rounded-2xl border border-leaf-200 bg-leaf-50 p-5">
          <div className="flex items-center gap-2 text-leaf-700">
            <Sparkles className="h-4 w-4" />
            <span className="text-sm font-semibold">Impact preview</span>
          </div>
          <div className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-ink-600">
              <span>Your gift</span>
              <span className="font-medium">{amountNum} {pool.asset}</span>
            </div>
            <div className="flex justify-between text-leaf-700">
              <span>Pool match (1:1)</span>
              <span className="font-medium">+{amountNum} {pool.asset}</span>
            </div>
            <div className="flex justify-between border-t border-leaf-200 pt-1.5 font-semibold text-ink-900">
              <span>Total impact</span>
              <span>{amountNum * 2} {pool.asset}</span>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleGive} className="mt-6 space-y-5">
        <Field label="Cause">
          {pools.length === 0 ? (
            <div className="rounded-xl border border-ink-200 bg-paper-soft px-4 py-3 text-sm text-ink-500">
              No active causes yet.{' '}
              <Link href="/causes/new" className="font-semibold text-bloom-600 hover:underline">
                Open one →
              </Link>
            </div>
          ) : (
            <select
              value={poolId}
              onChange={(e) => setPoolId(e.target.value)}
              className="w-full rounded-xl border border-ink-200 bg-paper px-4 py-3 text-sm text-ink-900 focus:border-bloom-400 focus:outline-none focus:ring-2 focus:ring-bloom-200"
            >
              {pools.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.causeName} · {formatAmount(p.remainingMinor)} {p.asset} match left
                </option>
              ))}
            </select>
          )}
          {pool && (
            <p className="mt-1.5 text-xs text-ink-500">
              {pool.causeDescription} · by {pool.sponsorName}
            </p>
          )}
        </Field>

        <Field label={`Amount (${pool?.asset ?? 'XLM'})`}>
          <div className="relative">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="10"
              className="w-full rounded-xl border border-ink-200 bg-paper px-4 py-3 pr-16 text-sm text-ink-900 focus:border-bloom-400 focus:outline-none focus:ring-2 focus:ring-bloom-200"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-ink-400">
              {pool?.asset ?? 'XLM'}
            </span>
          </div>
          <p className="mt-1.5 text-xs text-ink-400">
            Causes are funded and matched in native XLM — no trustline required.
          </p>
          {address && (
            <button
              type="button"
              onClick={handleEnableUsdc}
              disabled={enabling}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-bloom-600 hover:text-bloom-700 disabled:opacity-50"
            >
              {enabling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Optional: enable USDC on my wallet (one-tap trustline)
            </button>
          )}
        </Field>

        <Field label="Memo (optional)">
          <input
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            maxLength={28}
            placeholder="A note for the cause"
            className="w-full rounded-xl border border-ink-200 bg-paper px-4 py-3 text-sm text-ink-900 focus:border-bloom-400 focus:outline-none focus:ring-2 focus:ring-bloom-200"
          />
        </Field>

        {error && (
          <div className="rounded-xl border border-bloom-200 bg-bloom-50 px-4 py-3 text-sm text-bloom-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy || connecting || !valid}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-bloom-600 py-3.5 font-semibold text-white shadow-lift transition-colors hover:bg-bloom-700 disabled:opacity-60"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Signing &amp; matching…
            </>
          ) : (
            <>
              <HandHeart className="h-4 w-4" />
              {address ? 'Give & get matched 1:1' : 'Connect & give'}
            </>
          )}
        </button>
        {address && (
          <p className="text-center text-xs text-ink-400">
            Signing as <span className="font-mono">{truncateKey(address)}</span> · Stellar mainnet
          </p>
        )}
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink-700">{label}</span>
      {children}
    </label>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-ink-500">{label}</span>
      <span className={`font-semibold ${accent ? 'text-leaf-600' : 'text-ink-900'}`}>{value}</span>
    </div>
  );
}

function TxLink({ label, hash }: { label: string; hash: string }) {
  return (
    <a
      href={explorerTx(hash)}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between rounded-lg bg-paper-soft px-3 py-2 text-xs hover:bg-ink-50"
    >
      <span className="text-ink-500">{label}</span>
      <span className="inline-flex items-center gap-1 font-mono text-ink-700">
        {hash.slice(0, 10)}… <ArrowUpRight className="h-3 w-3" />
      </span>
    </a>
  );
}

export default function DonatePage() {
  return (
    <div className="min-h-screen">
      <Nav />
      <div className="px-4 pb-20 pt-28 sm:px-6">
        <Suspense
          fallback={
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-bloom-400" />
            </div>
          }
        >
          <DonateForm />
        </Suspense>
      </div>
      <Footer />
    </div>
  );
}
