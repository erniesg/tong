import type { Metadata } from 'next';
import Link from 'next/link';

import { CheckoutDemoForm } from './CheckoutDemoForm';
import { getStripeDemoConfig } from '@/lib/billing/config';

export const metadata: Metadata = {
  title: 'Tong Pricing Demo',
  description: 'Stripe-hosted checkout sandbox for the Tong demo.',
};

export const dynamic = 'force-dynamic';

type PricingPageProps = {
  searchParams?: {
    returnTo?: string | string[];
  };
};

function pickFirst(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default function PricingPage({ searchParams }: PricingPageProps) {
  const status = getStripeDemoConfig();
  const returnTo = pickFirst(searchParams?.returnTo);

  return (
    <main className="app-shell">
      <header className="page-header">
        <p className="kicker">Billing Demo</p>
        <h1 className="page-title">Stripe sandbox checkout for Tong</h1>
        <p className="page-copy">
          This is the fastest path to a real payment demo: one hosted Stripe Checkout page backed by a test secret key.
        </p>
        <div className="nav-links">
          <Link href="/" className="nav-link">
            Home
          </Link>
          <Link href="/roadmap" className="nav-link">
            Roadmap
          </Link>
          <Link href="/integrations" className="nav-link">
            Integrations
          </Link>
        </div>
      </header>

      <CheckoutDemoForm status={status} returnTo={returnTo} />
    </main>
  );
}
