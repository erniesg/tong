import Stripe from 'stripe';

import type {
  CheckoutSessionSummary,
  CreateCheckoutSessionRequest,
  CreateCheckoutSessionResponse,
} from '@/lib/billing/contracts';
import { getStripeDemoConfig } from '@/lib/billing/config';

let stripeClient: Stripe | null | undefined;

function getStripeClient() {
  if (stripeClient !== undefined) return stripeClient;

  const { secretKey } = getStripeDemoConfig();
  if (!secretKey) {
    stripeClient = null;
    return stripeClient;
  }

  stripeClient = new Stripe(secretKey, {
    appInfo: {
      name: 'Tong Demo Billing',
      version: '0.1.0',
      url: 'https://tong.berlayar.ai',
    },
  });

  return stripeClient;
}

function getCheckoutQuantity(quantity: number | undefined) {
  if (!Number.isFinite(quantity)) return 1;
  return Math.max(1, Math.min(10, Math.trunc(quantity as number)));
}

function buildAuctionReturnUrl(
  origin: string,
  returnTo: string | undefined,
  status: 'success' | 'cancelled',
  sessionId?: string,
) {
  if (!returnTo || !returnTo.startsWith('/')) {
    return null;
  }

  const url = new URL(returnTo, origin);
  url.searchParams.set('checkout', status);
  const base = url.toString();
  if (!sessionId) {
    return base;
  }
  return `${base}${base.includes('?') ? '&' : '?'}session_id=${sessionId}`;
}

function toCheckoutSessionSummary(
  session: Stripe.Checkout.Session,
  fallbackProductName: string,
  mode: CheckoutSessionSummary['mode'],
): CheckoutSessionSummary {
  const metadata = session.metadata ?? {};

  return {
    sessionId: session.id,
    mode,
    status: session.status,
    paymentStatus: session.payment_status,
    customerEmail: session.customer_details?.email || session.customer_email || null,
    amountTotal: session.amount_total,
    currency: session.currency,
    productName: metadata.demoProductName || fallbackProductName,
  };
}

export async function createDemoCheckoutSession(
  request: CreateCheckoutSessionRequest,
  origin: string,
): Promise<CreateCheckoutSessionResponse> {
  const stripe = getStripeClient();
  const config = getStripeDemoConfig();

  if (!stripe || config.mode === 'unconfigured') {
    throw new Error('Stripe is not configured. Add STRIPE_SECRET_KEY in apps/client/.env.local first.');
  }

  const successUrl =
    buildAuctionReturnUrl(origin, request.returnTo, 'success', '{CHECKOUT_SESSION_ID}')
    ?? `${origin}${config.successPath}?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl =
    buildAuctionReturnUrl(origin, request.returnTo, 'cancelled')
    ?? `${origin}${config.cancelPath}`;

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    billing_address_collection: 'auto',
    cancel_url: cancelUrl,
    success_url: successUrl,
    customer_creation: 'always',
    customer_email: request.email || undefined,
    line_items: [
      {
        quantity: getCheckoutQuantity(request.quantity),
        price_data: {
          currency: config.demoCurrency,
          unit_amount: config.demoAmountCents,
          product_data: {
            name: config.demoProductName,
            description: 'Sandbox checkout flow for the Tong demo.',
          },
        },
      },
    ],
    metadata: {
      demoProductName: config.demoProductName,
      userId: request.userId || '',
    },
  });

  if (!session.url) {
    throw new Error('Stripe returned a checkout session without a redirect URL.');
  }

  return {
    checkoutUrl: session.url,
    sessionId: session.id,
    mode: config.mode,
  };
}

export async function getCheckoutSessionSummary(sessionId: string): Promise<CheckoutSessionSummary | null> {
  const stripe = getStripeClient();
  const config = getStripeDemoConfig();

  if (!stripe || config.mode === 'unconfigured') return null;

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  return toCheckoutSessionSummary(session, config.demoProductName, config.mode);
}

export async function findLatestPaidCheckoutSessionSummary(userId: string): Promise<CheckoutSessionSummary | null> {
  const stripe = getStripeClient();
  const config = getStripeDemoConfig();

  if (!stripe || config.mode === 'unconfigured') return null;

  const sessions = await stripe.checkout.sessions.list({ limit: 25 });
  const latestPaid = sessions.data.find((session) => (
    session.metadata?.userId === userId
    && session.payment_status === 'paid'
  ));

  return latestPaid ? toCheckoutSessionSummary(latestPaid, config.demoProductName, config.mode) : null;
}
