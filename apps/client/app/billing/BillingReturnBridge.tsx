'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

const BILLING_RETURN_TO_STORAGE_KEY = 'tong.billing.returnTo';

function buildReturnHref(returnTo: string, sessionId: string) {
  const url = new URL(returnTo, window.location.origin);
  url.searchParams.set('checkout', 'success');
  url.searchParams.set('session_id', sessionId);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function BillingReturnBridge({ sessionId }: { sessionId: string | null }) {
  const [returnHref, setReturnHref] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId || typeof window === 'undefined') return;

    const stored = window.localStorage.getItem(BILLING_RETURN_TO_STORAGE_KEY) || '/auction/shanghai-live';

    const nextHref = buildReturnHref(stored, sessionId);
    setReturnHref(nextHref);

    const timer = window.setTimeout(() => {
      window.location.assign(nextHref);
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [sessionId]);

  const copy = useMemo(() => {
    if (!returnHref) return null;
    return 'Stripe finished. Returning to the auction now so Tong can top up your SP.';
  }, [returnHref]);

  if (!returnHref) return null;

  return (
    <div className="card stack">
      <p style={{ marginBottom: 0 }}>{copy}</p>
      <div className="row" style={{ justifyContent: 'flex-start', gap: 8 }}>
        <Link href={returnHref} className="button">
          Back to auction
        </Link>
      </div>
    </div>
  );
}
