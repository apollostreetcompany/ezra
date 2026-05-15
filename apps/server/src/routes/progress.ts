import type { FastifyInstance } from "fastify";
import { requireDeviceAuth } from "../services/auth.js";
import type { ProgressEventInput } from "../services/sync.js";
import type { ServerRouteContext } from "./context.js";

interface ProgressQuery {
  planId?: string;
}

export async function registerProgressRoutes(app: FastifyInstance, context: ServerRouteContext): Promise<void> {
  app.get<{ Querystring: ProgressQuery }>("/v1/progress", async (request, reply) => {
    const auth = await requireDeviceAuth(request, reply, context.store, context.tokenPepper, context.now);
    if (!auth) {
      return reply;
    }
    return { events: context.store.listProgress(auth, request.query.planId) };
  });

  app.post<{ Body: ProgressEventInput }>("/v1/progress", async (request, reply) => {
    const auth = await requireDeviceAuth(request, reply, context.store, context.tokenPepper, context.now);
    if (!auth) {
      return reply;
    }
    const event = context.store.recordProgress(auth, request.body);
    return reply.code(201).send({ event });
  });
}
