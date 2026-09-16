import type { BillingMode, BillingStatusResponse } from '@/lib/billing/contracts';

const DEFAULT_DEMO_PRODUCT_NAME = 'Tong Supporter Demo';
const DEFAULT_DEMO_AMOUNT_CENTS = 700;
const DEFAULT_DEMO_CURRENCY = 'usd';
const DEFAULT_SUCCESS_PATH = '/billing/success';
const DEFAULT_CANCEL_PATH = '/billing/cancel';

function parsePositiveInteger(raw: string | undefined, fallback: number) {
  if (!raw) return fallback;

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeCurrency(raw: string | undefined) {
  if (!raw) return DEFAULT_DEMO_CURRENCY;
  return raw.trim().toLowerCase() || DEFAULT_DEMO_CURRENCY;
}

function normalizePath(raw: string | undefined, fallback: string) {
  if (!raw) return fallback;
  return raw.startsWith('/') ? raw : fallback;
}

export interface StripeDemoConfig extends BillingStatusResponse {
  secretKey?: string;
}

export function getBillingModeFromSecretKey(secretKey: string | undefined): BillingMode {
  if (!secretKey) return 'unconfigured';
  if (secretKey.startsWith('sk_test_')) return 'test';
  if (secretKey.startsWith('sk_live_')) return 'live';
  return 'unconfigured';
}

export function getStripeDemoConfig(): StripeDemoConfig {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const mode = getBillingModeFromSecretKey(secretKey);

  return {
    configured: Boolean(secretKey),
    mode,
    secretKeyPresent: Boolean(secretKey),
    secretKey,
    demoProductName: process.env.STRIPE_DEMO_PRODUCT_NAME?.trim() || DEFAULT_DEMO_PRODUCT_NAME,
    demoAmountCents: parsePositiveInteger(process.env.STRIPE_DEMO_AMOUNT_CENTS, DEFAULT_DEMO_AMOUNT_CENTS),
    demoCurrency: normalizeCurrency(process.env.STRIPE_DEMO_CURRENCY),
    successPath: normalizePath(process.env.STRIPE_DEMO_SUCCESS_PATH, DEFAULT_SUCCESS_PATH),
    cancelPath: normalizePath(process.env.STRIPE_DEMO_CANCEL_PATH, DEFAULT_CANCEL_PATH),
  };
}
