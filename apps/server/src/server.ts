import Fastify, { type FastifyInstance } from "fastify";
import { pathToFileURL } from "node:url";
import { registerBibleRoutes } from "./routes/bibles.js";
import { registerBlockRoutes } from "./routes/block.js";
import { registerBillingRoutes } from "./routes/checkout.js";
import { registerDeviceTokenRoutes } from "./routes/deviceTokens.js";
import { registerLeaderboardRoutes } from "./routes/leaderboard.js";
import { registerPlanRoutes } from "./routes/plans.js";
import { registerProgressRoutes } from "./routes/progress.js";
import { registerReviewRoutes } from "./routes/reviews.js";
import { registerPassageRoutes } from "./routes/passages.js";
import { registerSearchRoutes } from "./routes/search.js";
import { ApiBibleClient } from "./services/apiBibleClient.js";
import { apiBibleProxyOptionsFromEnv, ApiBibleProxyService } from "./services/apiBibleProxy.js";
import { InMemorySyncStore } from "./services/sync.js";
import { BillingService, StripeSdkGateway, type StripeGateway } from "./services/stripe.js";

export const bibleCoderServerVersion = "0.1.0";

export interface BuildServerOptions {
  store?: InMemorySyncStore;
  tokenPepper?: string;
  now?: () => string;
  apiBibleProxy?: ApiBibleProxyService;
  apiBibleClient?: ApiBibleClient;
  billing?: BillingService;
  stripeGateway?: StripeGateway;
  env?: NodeJS.ProcessEnv;
}

export async function buildServer(options: BuildServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.addContentTypeParser("application/json", { parseAs: "buffer" }, (request, body, done) => {
    const rawBody = body as Buffer;
    if (request.url === "/v1/stripe/webhook") {
      done(null, rawBody);
      return;
    }
    try {
      done(null, rawBody.length === 0 ? {} : JSON.parse(rawBody.toString("utf8")) as unknown);
    } catch (error) {
      done(error as Error);
    }
  });
  const env = options.env ?? process.env;
  const now = options.now ?? (() => new Date().toISOString());
  const store = options.store ?? new InMemorySyncStore();
  const apiBibleClient = options.apiBibleClient ?? new ApiBibleClient({
    apiKey: env.API_BIBLE_KEY ?? "missing-api-key",
    ...(env.API_BIBLE_BASE_URL ? { baseUrl: env.API_BIBLE_BASE_URL } : {})
  });
  const stripeGateway = options.stripeGateway ?? new StripeSdkGateway(env.STRIPE_SECRET_KEY ?? "sk_test_missing");
  const context = {
    store,
    tokenPepper: resolveTokenPepper(options.tokenPepper),
    now,
    apiBibleProxy:
      options.apiBibleProxy ??
      new ApiBibleProxyService(store, apiBibleProxyOptionsFromEnv(env, apiBibleClient, now)),
    billing:
      options.billing ??
      new BillingService(store, {
        gateway: stripeGateway,
        priceId: env.STRIPE_PRICE_PREMIUM_MONTHLY,
        webhookSecret: env.STRIPE_WEBHOOK_SECRET,
        allowPromotionCodes: env.STRIPE_ALLOW_PROMOTION_CODES !== "false",
        automaticTaxEnabled: env.STRIPE_AUTOMATIC_TAX_ENABLED === "true",
        trialPeriodDays: readOptionalPositiveInteger(env.STRIPE_TRIAL_PERIOD_DAYS)
      })
  };

  app.get("/health", async () => ({ ok: true, service: "bible-coder-server", version: bibleCoderServerVersion }));
  await registerDeviceTokenRoutes(app, context);
  await registerPlanRoutes(app, context);
  await registerProgressRoutes(app, context);
  await registerReviewRoutes(app, context);
  await registerBibleRoutes(app, context);
  await registerPassageRoutes(app, context);
  await registerSearchRoutes(app, context);
  await registerBillingRoutes(app, context);
  await registerBlockRoutes(app, context);
  await registerLeaderboardRoutes(app, context);
  return app;
}

export async function startServer(): Promise<void> {
  const app = await buildServer();
  const port = Number.parseInt(process.env.PORT ?? "3000", 10);
  await app.listen({ host: "0.0.0.0", port });
}

function resolveTokenPepper(explicitPepper: string | undefined): string {
  if (explicitPepper) {
    return explicitPepper;
  }
  if (process.env.TOKEN_HASH_PEPPER) {
    return process.env.TOKEN_HASH_PEPPER;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("TOKEN_HASH_PEPPER is required in production.");
  }
  return "dev-only-token-pepper";
}

function readOptionalPositiveInteger(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await startServer();
}
