import type { FastifyInstance, FastifyReply } from "fastify";
import { requireDeviceAuth } from "../services/auth.js";
import { BillingConfigurationError, BillingSignatureError, type BillingService } from "../services/stripe.js";
import type { ServerRouteContext } from "./context.js";

interface CheckoutBody {
  successUrl?: string;
  cancelUrl?: string;
}

interface PortalBody {
  returnUrl?: string;
}

export async function registerBillingRoutes(app: FastifyInstance, context: ServerRouteContext & { billing: BillingService }): Promise<void> {
  app.post<{ Body: CheckoutBody }>("/v1/checkout/session", async (request, reply) => {
    const auth = await requireDeviceAuth(request, reply, context.store, context.tokenPepper, context.now);
    if (!auth) {
      return reply;
    }
    try {
      const session = await context.billing.createCheckoutSession(auth, {
        successUrl: request.body?.successUrl ?? "https://bible-coder.local/checkout/success",
        cancelUrl: request.body?.cancelUrl ?? "https://bible-coder.local/checkout/cancel"
      });
      return reply.code(201).send(session);
    } catch (error) {
      return handleBillingError(error, reply);
    }
  });

  app.post<{ Body: PortalBody }>("/v1/billing/portal", async (request, reply) => {
    const auth = await requireDeviceAuth(request, reply, context.store, context.tokenPepper, context.now);
    if (!auth) {
      return reply;
    }
    try {
      const session = await context.billing.createPortalSession(auth, {
        returnUrl: request.body?.returnUrl ?? "https://bible-coder.local/account"
      });
      return reply.code(201).send(session);
    } catch (error) {
      return handleBillingError(error, reply);
    }
  });

  app.post("/v1/stripe/webhook", async (request, reply) => {
    const signature = request.headers["stripe-signature"];
    const rawBody = Buffer.isBuffer(request.body) ? request.body : Buffer.from(JSON.stringify(request.body ?? {}));
    try {
      const result = context.billing.handleWebhook(rawBody, typeof signature === "string" ? signature : undefined);
      return reply.send(result);
    } catch (error) {
      return handleBillingError(error, reply);
    }
  });
}

function handleBillingError(error: unknown, reply: FastifyReply): unknown {
  if (error instanceof BillingConfigurationError) {
    return reply.code(503).send({ error: error.message });
  }
  if (error instanceof BillingSignatureError) {
    return reply.code(400).send({ error: error.message });
  }
  if (error instanceof Error && error.message.toLowerCase().includes("signature")) {
    return reply.code(400).send({ error: "invalid_stripe_signature" });
  }
  throw error;
}
