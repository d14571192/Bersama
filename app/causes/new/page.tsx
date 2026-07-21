'use client';

import { CheckCircle2, ChevronLeft, Loader2, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import { useWallet } from '@/components/WalletProvider';
import { signXdr } from '@/lib/wallet';

export default function NewCausePage() {
  const { address, connect, connecting } = useWallet();
  const [sponsorName, setSponsorName] = useState('');
  const [causeName, setCauseName] = useState('');
  const [causeDescription, setCauseDescription] = useState('');
  const [causePublicKey, setCausePublicKey] = useState('');
  const [matchFund, setMatchFund] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ id: string; causeName: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    let sponsor = address;
    if (!sponsor) {
      sponsor = await connect();
      if (!sponsor) return;
    }
    const payout = causePublicKey || sponsor;
    const meta = { sponsorName, causeName, causeDescription, causePublicKey: payout, matchFund };
    setBusy(true);
    try {
      // 1) Prepare the sponsor-signed fund_pool invoke (locks the match on-chain).
      const prep = await fetch('/api/pools/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(meta),
      }).then((r) => r.json());
      if (!prep.ok) throw new Error(prep.error?.message ?? 'Could not prepare the match fund');

      // 2) Sign it with Freighter.
      const signed = await signXdr(prep.data.xdr, sponsor);

      // 3) Submit — the contract locks the match fund, then we record the cause.
      const res = await fetch('/api/pools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...meta, poolKey: prep.data.poolKey, signedXdr: signed }),
      }).then((r) => r.json());
      if (!res.ok) throw new Error(res.error?.message ?? 'Could not open cause');
      setDone({ id: res.data.pool.id, causeName: res.data.pool.causeName });
      toast.success('Cause funded on-chain!');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not open cause';
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen">
        <Nav />
        <div className="mx-auto flex max-w-md flex-col items-center px-4 pb-20 pt-36 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-leaf-50 text-leaf-600">
            <CheckCircle2 className="h-9 w-9" />
          </div>
          <h1 className="mt-5 font-display text-3xl font-600 text-ink-900">Cause is live</h1>
          <p className="mt-2 text-ink-600">
            <span className="font-semibold text-ink-900">{done.causeName}</span> is now matching gifts
            1:1.
          </p>
          <div className="mt-7 flex w-full flex-col gap-2">
            <Link
              href={`/donate?poolId=${done.id}`}
              className="rounded-xl bg-bloom-600 py-3 font-semibold text-white hover:bg-bloom-700"
            >
              Make the first gift
            </Link>
            <Link
              href="/causes"
              className="rounded-xl border border-ink-200 py-3 text-sm font-semibold text-ink-700 hover:border-ink-300"
            >
              View all causes
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Nav />
      <div className="mx-auto max-w-lg px-4 pb-20 pt-28 sm:px-6">
        <Link href="/causes" className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900">
          <ChevronLeft className="h-4 w-4" /> Causes
        </Link>
        <h1 className="font-display text-4xl font-600 tracking-tight text-ink-900">Open a cause</h1>
        <p className="mt-2 text-ink-600">
          Pledge a match fund and name the cause it doubles. Gifts and matches both settle to the
          payout address you choose.
        </p>

        {!address && (
          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-bloom-200 bg-bloom-50 p-4">
            <Wallet className="h-5 w-5 shrink-0 text-bloom-600" />
            <p className="text-sm text-ink-700">Connect Freighter to open a cause as its sponsor.</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <Field label="Sponsor name / organization">
            <input
              value={sponsorName}
              onChange={(e) => setSponsorName(e.target.value)}
              required
              maxLength={100}
              placeholder="Your name or organization"
              className={input}
            />
          </Field>
          <Field label="Cause name">
            <input
              value={causeName}
              onChange={(e) => setCauseName(e.target.value)}
              required
              maxLength={100}
              placeholder="What are you raising for?"
              className={input}
            />
          </Field>
          <Field label="Description">
            <textarea
              value={causeDescription}
              onChange={(e) => setCauseDescription(e.target.value)}
              required
              rows={3}
              maxLength={500}
              placeholder="How will the funds be used?"
              className={`${input} resize-none`}
            />
          </Field>
          <Field label="Payout address (cause receives gifts + matches)">
            <input
              value={causePublicKey}
              onChange={(e) => setCausePublicKey(e.target.value)}
              placeholder={address ? `${address.slice(0, 12)}… (your wallet)` : 'G… Stellar address'}
              className={`${input} font-mono`}
            />
            <p className="mt-1 text-xs text-ink-400">Leave blank to use your connected wallet.</p>
          </Field>
          <Field label="Match fund (XLM)">
            <input
              value={matchFund}
              onChange={(e) => setMatchFund(e.target.value)}
              required
              inputMode="decimal"
              placeholder="100"
              className={input}
            />
            <p className="mt-1 text-xs text-ink-400">
              Locked into the Match Pool contract on-chain when you sign. Native XLM — no trustline
              needed.
            </p>
          </Field>

          {error && (
            <div className="rounded-xl border border-bloom-200 bg-bloom-50 px-4 py-3 text-sm text-bloom-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy || connecting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-bloom-600 py-3.5 font-semibold text-white shadow-lift transition-colors hover:bg-bloom-700 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {busy ? 'Funding on-chain…' : address ? 'Fund match pool on-chain' : 'Connect & fund pool'}
          </button>
        </form>
      </div>
      <Footer />
    </div>
  );
}

const input =
  'w-full rounded-xl border border-ink-200 bg-paper px-4 py-3 text-sm text-ink-900 focus:border-bloom-400 focus:outline-none focus:ring-2 focus:ring-bloom-200';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink-700">{label}</span>
      {children}
    </label>
  );
}
