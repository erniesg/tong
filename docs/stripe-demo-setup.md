# Stripe Demo Setup

This repo now includes a minimal hosted Stripe Checkout demo at `/pricing`.

## What this includes

- `POST /api/billing/checkout`
- `GET /api/billing/status`
- `/pricing`
- `/billing/success`
- `/billing/cancel`

This is intentionally narrow:

- one-time payment only
- Stripe-hosted Checkout
- no webhook yet
- no entitlement sync yet

That keeps the setup safe for demos while the worker and gameplay branches are still moving.

## 1. Get a Stripe sandbox key

From Stripe Dashboard:

1. Open your account picker.
2. Create or open a `Sandbox`.
3. Inside that sandbox, go to `Developers` -> `API keys`.
4. Reveal the test secret key.
5. Copy the `sk_test_...` value.

Official docs:

- https://docs.stripe.com/keys
- https://docs.stripe.com/sandboxes

## 2. Add env vars

Create `apps/client/.env.local` with:

```bash
NEXT_PUBLIC_TONG_API_BASE=http://localhost:8787
NEXT_PUBLIC_TONG_ASSETS_BASE_URL=https://assets.tong.berlayar.ai

STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_DEMO_PRODUCT_NAME=Tong Supporter Demo
STRIPE_DEMO_AMOUNT_CENTS=700
STRIPE_DEMO_CURRENCY=usd
STRIPE_DEMO_SUCCESS_PATH=/billing/success
STRIPE_DEMO_CANCEL_PATH=/billing/cancel
```

Only `STRIPE_SECRET_KEY` is required for the current demo.

## 3. Run it

From repo root:

```bash
npm run dev:client
```

Open:

```bash
http://localhost:3000/pricing
```

## 4. Test a payment

Use Stripe sandbox card data:

- Card number: `4242 4242 4242 4242`
- Any future expiry date
- Any CVC
- Any ZIP/postal code

Official docs:

- https://docs.stripe.com/testing?testing-method=payment-methods

## 5. What to build next

Once the demo flow is confirmed, the next safe slice is:

1. webhook endpoint
2. worker-side ledger or entitlement table
3. success state backed by webhook events instead of redirect-only confirmation
