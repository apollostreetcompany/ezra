import type { FastifyInstance } from "fastify";
import { requireDeviceAuth } from "../services/auth.js";
import { ApiBibleAccessError, type ApiBibleProxyService } from "../services/apiBibleProxy.js";
import type { ServerRouteContext } from "./context.js";

export async function registerBibleRoutes(app: FastifyInstance, context: ServerRouteContext & { apiBibleProxy: ApiBibleProxyService }): Promise<void> {
  app.get("/v1/bibles", async (request, reply) => {
    const auth = await requireDeviceAuth(request, reply, context.store, context.tokenPepper, context.now);
    if (!auth) {
      return reply;
    }
    try {
      return await context.apiBibleProxy.listBibles(auth);
    } catch (error) {
      return handleApiBibleError(error, reply);
    }
  });
}

export function handleApiBibleError(error: unknown, reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown } }): unknown {
  if (error instanceof ApiBibleAccessError) {
    const statusCode = error.reason === "missing_api_key" ? 503 : 403;
    return reply.code(statusCode).send({ error: error.reason });
  }
  throw error;
}
