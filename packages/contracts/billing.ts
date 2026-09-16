export type BillingMode = 'test' | 'live' | 'unconfigured';

export interface BillingStatusResponse {
  configured: boolean;
  mode: BillingMode;
  secretKeyPresent: boolean;
  demoProductName: string;
  demoAmountCents: number;
  demoCurrency: string;
  successPath: string;
  cancelPath: string;
}

export interface CreateCheckoutSessionRequest {
  email?: string;
  userId?: string;
  quantity?: number;
  returnTo?: string;
}

export interface CreateCheckoutSessionResponse {
  checkoutUrl: string;
  sessionId: string;
  mode: Exclude<BillingMode, 'unconfigured'>;
}

export interface CheckoutSessionSummary {
  sessionId: string;
  mode: Exclude<BillingMode, 'unconfigured'>;
  status: string | null;
  paymentStatus: string | null;
  customerEmail: string | null;
  amountTotal: number | null;
  currency: string | null;
  productName: string | null;
}
