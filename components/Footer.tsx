import { Sprout } from 'lucide-react';
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-ink-100 bg-paper-soft">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bloom-gradient text-white">
            <Sprout className="h-4 w-4" />
          </span>
          <span className="font-display text-base font-600 text-ink-900">Bersama</span>
          <span className="text-sm text-ink-400">— together, doubled.</span>
        </div>
        <div className="flex items-center gap-5 text-sm text-ink-500">
          <Link href="/causes" className="hover:text-ink-900">Causes</Link>
          <Link href="/donate" className="hover:text-ink-900">Donate</Link>
          <Link href="/stats" className="hover:text-ink-900">Stats</Link>
          <span className="text-ink-300">Stellar mainnet</span>
        </div>
      </div>
    </footer>
  );
}
