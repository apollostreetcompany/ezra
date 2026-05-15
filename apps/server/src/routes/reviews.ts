import type { FastifyInstance } from "fastify";
import { requireDeviceAuth } from "../services/auth.js";
import type { ReviewEventInput } from "../services/sync.js";
import type { ServerRouteContext } from "./context.js";

export async function registerReviewRoutes(app: FastifyInstance, context: ServerRouteContext): Promise<void> {
  app.get("/v1/reviews", async (request, reply) => {
    const auth = await requireDeviceAuth(request, reply, context.store, context.tokenPepper, context.now);
    if (!auth) {
      return reply;
    }
    return { events: context.store.listReviews(auth) };
  });

  app.post<{ Body: ReviewEventInput }>("/v1/reviews", async (request, reply) => {
    const auth = await requireDeviceAuth(request, reply, context.store, context.tokenPepper, context.now);
    if (!auth) {
      return reply;
    }
    const event = context.store.recordReview(auth, request.body);
    return reply.code(201).send({ event });
  });
}
