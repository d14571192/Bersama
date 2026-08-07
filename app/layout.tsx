import type { Metadata } from 'next';
import { Fraunces, Plus_Jakarta_Sans } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { Toaster } from 'sonner';
import { WalletProvider } from '@/components/WalletProvider';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-fraunces',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Bersama — Donations, doubled on Stellar',
  description:
    'Bersama pairs every gift with an on-chain 1:1 sponsor match. Give XLM and a Soroban smart contract doubles it atomically on Stellar mainnet.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${jakarta.variable} ${fraunces.variable}`}>
      <body className="font-sans antialiased">
        <NextIntlClientProvider messages={messages}>
          <WalletProvider>{children}</WalletProvider>
          <Toaster
            position="top-center"
            richColors
            toastOptions={{ style: { fontFamily: 'var(--font-jakarta)' } }}
          />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
