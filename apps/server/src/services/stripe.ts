import Stripe from "stripe";
import type { DeviceAuth, InMemorySyncStore } from "./sync.js";

export interface CheckoutInput {
  successUrl: string;
  cancelUrl: string;
}

export interface PortalInput {
  returnUrl: string;
}

export interface StripeGateway {
  createCheckoutSession(input: {
    userId: string;
    deviceId: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    allowPromotionCodes: boolean;
    automaticTaxEnabled: boolean;
    trialPeriodDays: number | null;
    idempotencyKey: string;
  }): Promise<{ id: string; url: string | null }>;
  createBillingPortalSession(input: { customerId: string; returnUrl: string }): Promise<{ id: string; url: string }>;
  constructWebhookEvent(rawBody: Buffer, signature: string, webhookSecret: string): Stripe.Event;
}

export class StripeSdkGateway implements StripeGateway {
  private readonly stripe: Stripe;

  constructor(secretKey: string) {
    this.stripe = new Stripe(secretKey);
  }

  async createCheckoutSession(input: {
    userId: string;
    deviceId: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    allowPromotionCodes: boolean;
    automaticTaxEnabled: boolean;
    trialPeriodDays: number | null;
    idempotencyKey: string;
  }): Promise<{ id: string; url: string | null }> {
    const subscriptionData: { metadata: Record<string, string>; trial_period_days?: number } = {
      metadata: {
        user_id: input.userId,
        device_id: input.deviceId
      }
    };
    if (input.trialPeriodDays !== null) {
      subscriptionData.trial_period_days = input.trialPeriodDays;
    }
    const session = await this.stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: input.priceId, quantity: 1 }],
      client_reference_id: input.userId,
      allow_promotion_codes: input.allowPromotionCodes,
      automatic_tax: { enabled: input.automaticTaxEnabled },
      metadata: {
        user_id: input.userId,
        device_id: input.deviceId
      },
      subscription_data: subscriptionData,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl
    }, {
      idempotencyKey: input.idempotencyKey
    });
    return { id: session.id, url: session.url };
  }

  async createBillingPortalSession(input: { customerId: string; returnUrl: string }): Promise<{ id: string; url: string }> {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: input.customerId,
      return_url: input.returnUrl
    });
    return { id: session.id, url: session.url };
  }

  constructWebhookEvent(rawBody: Buffer, signature: string, webhookSecret: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  }
}

export interface BillingServiceOptions {
  gateway: StripeGateway;
  priceId: string | undefined;
  webhookSecret: string | undefined;
  allowPromotionCodes?: boolean;
  automaticTaxEnabled?: boolean;
  trialPeriodDays?: number | null;
}

export class BillingService {
  constructor(private readonly store: InMemorySyncStore, private readonly options: BillingServiceOptions) {}

  async createCheckoutSession(auth: DeviceAuth, input: CheckoutInput): Promise<{ id: string; url: string | null }> {
    if (!this.options.priceId) {
      throw new BillingConfigurationError("missing_stripe_price");
    }
    return await this.options.gateway.createCheckoutSession({
      userId: auth.userId,
      deviceId: auth.deviceId,
      priceId: this.options.priceId,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      allowPromotionCodes: this.options.allowPromotionCodes ?? true,
      automaticTaxEnabled: this.options.automaticTaxEnabled ?? false,
      trialPeriodDays: this.options.trialPeriodDays ?? null,
      idempotencyKey: `checkout_${auth.userId}_${this.options.priceId}`
    });
  }

  async createPortalSession(auth: DeviceAuth, input: PortalInput): Promise<{ id: string; url: string }> {
    const customer = [...this.store.stripeCustomers.values()].find((entry) => entry.userId === auth.userId);
    if (!customer) {
      throw new BillingConfigurationError("missing_stripe_customer");
    }
    return await this.options.gateway.createBillingPortalSession({ customerId: customer.customerId, returnUrl: input.returnUrl });
  }

  handleWebhook(rawBody: Buffer, signature: string | undefined): { received: true; duplicate: boolean; eventId?: string } {
    if (!this.options.webhookSecret) {
      throw new BillingConfigurationError("missing_stripe_webhook_secret");
    }
    if (!signature) {
      throw new BillingSignatureError("missing_stripe_signature");
    }
    const event = this.options.gateway.constructWebhookEvent(rawBody, signature, this.options.webhookSecret);
    const firstProcessing = this.store.markStripeEventProcessed(event.id);
    if (!firstProcessing) {
      return { received: true, duplicate: true, eventId: event.id };
    }
    this.applyStripeEvent(event);
    return { received: true, duplicate: false, eventId: event.id };
  }

  private applyStripeEvent(event: Stripe.Event): void {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id ?? session.client_reference_id ?? undefined;
      const customerId = typeof session.customer === "string" ? session.customer : undefined;
      const subscriptionId = typeof session.subscription === "string" ? session.subscription : undefined;
      if (userId && customerId) {
        this.store.setStripeCustomer(userId, customerId);
      }
      if (userId && subscriptionId) {
        this.store.setStripeSubscription({ userId, subscriptionId, status: "active" });
      }
      return;
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = typeof subscription.customer === "string" ? subscription.customer : undefined;
      const userId = subscription.metadata?.user_id ?? (customerId ? this.store.findUserIdByStripeCustomer(customerId) : undefined);
      if (userId) {
        this.store.setStripeSubscription({
          userId,
          subscriptionId: subscription.id,
          status: subscription.status,
          currentPeriodEnd: subscription.items?.data?.[0]?.current_period_end
            ? new Date(subscription.items.data[0].current_period_end * 1000).toISOString()
            : null
        });
      }
      return;
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : undefined;
      const userId = customerId ? this.store.findUserIdByStripeCustomer(customerId) : undefined;
      const subscriptionId = typeof (invoice as Stripe.Invoice & { subscription?: unknown }).subscription === "string"
        ? String((invoice as Stripe.Invoice & { subscription?: unknown }).subscription)
        : `invoice_${invoice.id}`;
      if (userId) {
        this.store.setStripeSubscription({ userId, subscriptionId, status: "past_due" });
      }
    }
  }
}

export class BillingConfigurationError extends Error {}

export class BillingSignatureError extends Error {}
