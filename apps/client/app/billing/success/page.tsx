import Link from 'next/link';

import { BillingReturnBridge } from '../BillingReturnBridge';
import { getStripeDemoConfig } from '@/lib/billing/config';
import { getCheckoutSessionSummary } from '@/lib/billing/stripe';

export const dynamic = 'force-dynamic';

function formatAmount(amountTotal: number | null, currency: string | null) {
  if (amountTotal === null || !currency) return null;

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amountTotal / 100);
}

type BillingSuccessPageProps = {
  searchParams?: {
    session_id?: string | string[];
  };
};

export default async function BillingSuccessPage({ searchParams }: BillingSuccessPageProps) {
  const sessionId =
    typeof searchParams?.session_id === 'string'
      ? searchParams.session_id
      : Array.isArray(searchParams?.session_id)
        ? searchParams?.session_id[0]
        : undefined;

  const config = getStripeDemoConfig();
  const summary = sessionId ? await getCheckoutSessionSummary(sessionId) : null;
  const formattedAmount = formatAmount(summary?.amountTotal ?? null, summary?.currency ?? null);

  return (
    <main className="app-shell">
      <header className="page-header">
        <p className="kicker">Checkout Complete</p>
        <h1 className="page-title">Stripe sent you back successfully</h1>
        <p className="page-copy">
          This confirms the demo checkout path is working. For sandbox runs, no real money moves.
        </p>
      </header>

      <section className="grid grid-2" style={{ alignItems: 'start' }}>
        <article className="card stack">
          <div className="row">
            <h2 style={{ margin: 0 }}>Session</h2>
            <span className="pill">{summary?.paymentStatus || 'unknown'}</span>
          </div>
          <p style={{ marginBottom: 0 }}>
            Product: <strong>{summary?.productName || config.demoProductName}</strong>
          </p>
          <p style={{ marginBottom: 0 }}>
            Amount: <strong>{formattedAmount || 'Unavailable'}</strong>
          </p>
          <p style={{ marginBottom: 0 }}>
            Customer: <strong>{summary?.customerEmail || 'Unavailable'}</strong>
          </p>
          <p style={{ marginBottom: 0 }}>
            Session ID: <code>{summary?.sessionId || sessionId || 'missing'}</code>
          </p>
        </article>

        <article className="card stack">
          <div className="row">
            <h2 style={{ margin: 0 }}>Next step</h2>
            <span className="pill">{config.mode === 'live' ? 'Live key' : 'Sandbox key'}</span>
          </div>
          <p>
            If you want this to drive actual product access, the next slice is a webhook plus a durable entitlement or
            wallet ledger in the worker/D1 layer.
          </p>
          <div className="row" style={{ justifyContent: 'flex-start', gap: 8 }}>
            <Link href="/pricing" className="button">
              Run it again
            </Link>
            <Link href="/" className="button secondary">
              Back home
            </Link>
          </div>
        </article>
      </section>

      <section style={{ marginTop: 16 }}>
        <BillingReturnBridge sessionId={summary?.sessionId || sessionId || null} />
      </section>
    </main>
  );
}
