'use client';

import { Sprout } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@/components/ConnectButton';

const LINKS = [
  { href: '/causes', label: 'Causes' },
  { href: '/donate', label: 'Donate' },
  { href: '/stats', label: 'Stats' },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-ink-100 bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bloom-gradient text-white">
            <Sprout className="h-5 w-5" />
          </span>
          <span className="font-display text-xl font-600 tracking-tight text-ink-900">Bersama</span>
        </Link>
        <div className="hidden items-center gap-7 text-sm font-medium text-ink-500 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`transition-colors hover:text-ink-900 ${
                pathname === l.href ? 'text-ink-900' : ''
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>
        <ConnectButton />
      </div>
    </nav>
  );
}
