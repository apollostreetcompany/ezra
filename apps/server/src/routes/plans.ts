import type { FastifyInstance } from "fastify";
import { requireDeviceAuth } from "../services/auth.js";
import type { PlanCreateInput } from "../services/sync.js";
import type { ServerRouteContext } from "./context.js";

export async function registerPlanRoutes(app: FastifyInstance, context: ServerRouteContext): Promise<void> {
  app.get("/v1/plans", async (request, reply) => {
    const auth = await requireDeviceAuth(request, reply, context.store, context.tokenPepper, context.now);
    if (!auth) {
      return reply;
    }
    return { plans: context.store.listPlans(auth) };
  });

  app.post<{ Body: PlanCreateInput }>("/v1/plans", async (request, reply) => {
    const auth = await requireDeviceAuth(request, reply, context.store, context.tokenPepper, context.now);
    if (!auth) {
      return reply;
    }
    const plan = context.store.savePlan(auth, request.body, context.now());
    return reply.code(201).send({ plan });
  });
}
