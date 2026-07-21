import path from 'node:path';
import { type BrowserContext, type Page, chromium, expect, test } from '@playwright/test';
import {
  approveOnce,
  cleanup,
  FREIGHTER,
  getExtensionId,
  launchWithFreighter,
  onboardFreighter,
} from '../../../../../shared/freighter/freighter-fixture';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'https://bersama-sigma.vercel.app';
const SHOTS = path.resolve(process.cwd(), '..', 'screen-shot');
const shot = (name: string) => path.join(SHOTS, name);
const PUB = FREIGHTER.deployerPublic;
const ADDR_HEAD = PUB.slice(0, 5);

test.describe.configure({ mode: 'serial' });

let context: BrowserContext;
let userDataDir: string;

test.beforeAll(async () => {
  const launched = await launchWithFreighter(chromium);
  context = launched.context;
  userDataDir = launched.userDataDir;
  await onboardFreighter(context);
});

test.afterAll(async () => {
  if (context) await cleanup(context, userDataDir);
});

function walletAddress(page: Page) {
  return page.getByText(new RegExp(ADDR_HEAD)).first();
}

async function clickConnect(page: Page): Promise<void> {
  const connectBtn = page.getByRole('button', { name: /connect wallet/i }).first();
  await expect(connectBtn).toBeVisible({ timeout: 20_000 });
  await connectBtn.click();
}

const APPROVAL_ROUTES = ['grant-access', 'sign-transaction', 'sign-auth-entry', 'sign-message'];
const APPROVE_BUTTONS = [
  'grant-access-connect-button',
  'sign-transaction-sign',
  'sign-auth-entry-approve-button',
  'sign-message-approve-button',
];

function findApprovalPopup(context: BrowserContext): Page | null {
  const prefix = `chrome-extension://${getExtensionId(context)}`;
  for (const p of context.pages()) {
    if (p.isClosed() || !p.url().startsWith(prefix)) continue;
    if (APPROVAL_ROUTES.some((route) => p.url().includes(route))) return p;
  }
  return null;
}

async function popupHasApproveButton(popup: Page): Promise<boolean> {
  for (const tid of APPROVE_BUTTONS) {
    const btn = popup.locator(`[data-testid=${tid}]`).first();
    if ((await btn.isVisible().catch(() => false)) === true) return true;
  }
  return false;
}

async function captureApprovalPopup(
  context: BrowserContext,
  file: string,
  ms: number,
): Promise<void> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const popup = findApprovalPopup(context);
    if (popup && (await popupHasApproveButton(popup))) {
      await popup.waitForTimeout(400);
      await popup.screenshot({ path: file, type: 'jpeg', quality: 85 }).catch(() => {});
      return;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
}

async function approveUntilConnected(
  context: BrowserContext,
  page: Page,
  ms: number,
): Promise<boolean> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await walletAddress(page).isVisible().catch(() => false)) return true;
    await approveOnce(context, { timeout: 5_000 }).catch(() => {});
    await page.waitForTimeout(500);
  }
  return walletAddress(page).isVisible().catch(() => false);
}

async function connectWallet(context: BrowserContext, page: Page): Promise<void> {
  await clickConnect(page);
  await captureApprovalPopup(context, shot('02-connect-popup.jpg'), 15_000);
  await approveOnce(context, { timeout: 60_000 }).catch(() => {});
  await captureApprovalPopup(context, shot('03-approve.jpg'), 15_000);
  await approveOnce(context, { timeout: 60_000 }).catch(() => {});
  if (await approveUntilConnected(context, page, 25_000)) return;

  for (let attempt = 0; attempt < 3; attempt++) {
    if (await walletAddress(page).isVisible().catch(() => false)) return;
    await clickConnect(page);
    if (await approveUntilConnected(context, page, 30_000)) return;
  }
  await expect(walletAddress(page)).toBeVisible({ timeout: 15_000 });
}

async function fillDonationAmount(page: Page): Promise<void> {
  await expect(page.locator('select')).toBeVisible({ timeout: 20_000 });
  await page.getByPlaceholder('10').fill('2.5');
  await expect(page.getByText(/Impact preview/i)).toBeVisible({ timeout: 10_000 });
}

test('real Freighter: SEP-10 connect + on-chain doubled donation (gift + 1:1 match)', async () => {
  test.setTimeout(360_000);
  const page = await context.newPage();

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('h1')).toContainText('doubled', { timeout: 30_000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: shot('01-landing.jpg'), type: 'jpeg', quality: 85, fullPage: true });

  await connectWallet(context, page);
  await expect(walletAddress(page)).toBeVisible({ timeout: 15_000 });

  await page.goto(`${BASE_URL}/donate`, { waitUntil: 'domcontentloaded' });
  await fillDonationAmount(page);
  await page.screenshot({ path: shot('04-donate-form.jpg'), type: 'jpeg', quality: 85, fullPage: true });

  let donation: {
    ok?: boolean;
    data?: { donation?: { horizonTxHash?: string } };
    error?: { message?: string };
  } = {};
  page.on('response', async (r) => {
    if (r.url().includes('/api/donations') && r.request().method() === 'POST') {
      try {
        donation = await r.json();
      } catch {
        /* ignore */
      }
    }
  });

  await page.getByRole('button', { name: /give & get matched|connect & give/i }).click();
  await captureApprovalPopup(context, shot('03-approve.jpg'), 20_000);
  await approveOnce(context, { timeout: 90_000 });

  await expect(page.getByRole('heading', { name: 'Doubled.' })).toBeVisible({ timeout: 150_000 });
  await expect(page.getByText(/On-chain tx \(gift \+ 1:1 match\)/i)).toBeVisible({
    timeout: 20_000,
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: shot('05-success.jpg'), type: 'jpeg', quality: 85, fullPage: true });

  const txLink = page.locator('a[href*="stellar.expert/explorer/testnet/tx/"]').first();
  await expect(txLink).toBeVisible({ timeout: 20_000 });
  const href = await txLink.getAttribute('href');
  expect(href).toMatch(/stellar\.expert\/explorer\/testnet\/tx\/[0-9a-f]{64}/);
  expect(donation.ok, `donation failed: ${donation.error?.message}`).toBeTruthy();
  expect(donation.data?.donation?.horizonTxHash, 'real tx hash present').toBeTruthy();
  // biome-ignore lint/suspicious/noConsole: surface the hash for the convert report
  console.log(
    'PROD_TX_HASH=' + (donation.data?.donation?.horizonTxHash ?? href?.split('/tx/')[1] ?? ''),
  );

  await page.goto(`${BASE_URL}/stats`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('h1')).toContainText('impact', { timeout: 20_000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: shot('06-stats.jpg'), type: 'jpeg', quality: 85, fullPage: true });
});

test('mobile landing renders', async () => {
  const page = await context.newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('h1')).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: shot('07-mobile.jpg'), type: 'jpeg', quality: 85, fullPage: true });
});
