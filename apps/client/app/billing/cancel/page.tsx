import Link from 'next/link';

export default function BillingCancelPage() {
  return (
    <main className="app-shell">
      <header className="page-header">
        <p className="kicker">Checkout Cancelled</p>
        <h1 className="page-title">No payment was completed</h1>
        <p className="page-copy">
          Stripe sent the browser back through the cancel URL. The integration is still working; the checkout was just
          aborted before confirmation.
        </p>
      </header>

      <section className="card stack">
        <p style={{ marginBottom: 0 }}>
          You can return to the pricing page and try again with Stripe’s sandbox card values.
        </p>
        <div className="row" style={{ justifyContent: 'flex-start', gap: 8 }}>
          <Link href="/pricing" className="button">
            Back to pricing
          </Link>
          <Link href="/" className="button secondary">
            Back home
          </Link>
        </div>
      </section>
    </main>
  );
}
