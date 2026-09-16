'use client';

import { useState } from 'react';

import type { BillingStatusResponse, CreateCheckoutSessionResponse } from '@/lib/billing/contracts';

const BILLING_RETURN_TO_STORAGE_KEY = 'tong.billing.returnTo';

export function CheckoutDemoForm({
  status,
  returnTo,
}: {
  status: BillingStatusResponse;
  returnTo?: string | null;
}) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setIsSubmitting(true);
      setError(null);

      if (typeof window !== 'undefined') {
        if (returnTo) {
          window.localStorage.setItem(BILLING_RETURN_TO_STORAGE_KEY, returnTo);
        } else {
          window.localStorage.removeItem(BILLING_RETURN_TO_STORAGE_KEY);
        }
      }

      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim() || undefined,
          returnTo: returnTo || undefined,
        }),
      });

      const payload = await response.json() as CreateCheckoutSessionResponse & { error?: string };
      if (!response.ok || !payload.checkoutUrl) {
        throw new Error(payload.error || 'Stripe checkout could not be started.');
      }

      window.location.assign(payload.checkoutUrl);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Stripe checkout could not be started.');
      setIsSubmitting(false);
    }
  }

  return (
    <section className="grid grid-2" style={{ alignItems: 'start' }}>
      <article className="card stack">
        <div className="row">
          <h2 style={{ margin: 0 }}>Hosted Checkout</h2>
          <span className="pill">{status.mode === 'unconfigured' ? 'Needs key' : `${status.mode} mode`}</span>
        </div>
        <p>
          This demo uses Stripe-hosted Checkout with a single one-time charge. There is no webhook or entitlement
          sync yet; the goal is to get a real payment flow running safely in sandbox mode.
        </p>
        {returnTo ? (
          <p style={{ marginBottom: 0 }}>
            After payment, Tong will route you back into the live auction and apply the SP top-up there.
          </p>
        ) : null}
        <div className="stack" style={{ gap: 8 }}>
          <div className="row">
            <span>Product</span>
            <strong>{status.demoProductName}</strong>
          </div>
          <div className="row">
            <span>Amount</span>
            <strong>
              {(status.demoAmountCents / 100).toFixed(2)} {status.demoCurrency.toUpperCase()}
            </strong>
          </div>
        </div>

        <form className="stack" onSubmit={handleSubmit}>
          <label className="stack" style={{ gap: 6 }}>
            <span>Email for the Stripe receipt</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="demo@tong.app"
              autoComplete="email"
              style={{
                width: '100%',
                borderRadius: 14,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(12,14,24,0.72)',
                color: 'inherit',
                padding: '0.9rem 1rem',
              }}
            />
          </label>

          <button type="submit" disabled={isSubmitting || !status.configured}>
            {isSubmitting ? 'Redirecting to Stripe...' : 'Open Stripe Checkout'}
          </button>
          {error ? <p style={{ color: '#fda4af', margin: 0 }}>{error}</p> : null}
        </form>
      </article>

      <article className="card stack">
        <div className="row">
          <h2 style={{ margin: 0 }}>Setup</h2>
          <span className="pill">{status.secretKeyPresent ? 'Configured' : 'Pending'}</span>
        </div>
        <ol style={{ margin: 0, paddingLeft: '1.25rem', display: 'grid', gap: 10 }}>
          <li>Open Stripe Dashboard and create or open a sandbox.</li>
          <li>Go to Developers, then API keys, then reveal the test secret key.</li>
          <li>
            Put it in <code>apps/client/.env.local</code> as <code>STRIPE_SECRET_KEY=sk_test_...</code>.
          </li>
          <li>Restart the client dev server and reload this page.</li>
        </ol>
        <p style={{ marginBottom: 0 }}>
          Test card: <code>4242 4242 4242 4242</code>, any future expiry, any CVC, any ZIP.
        </p>
      </article>
    </section>
  );
}
