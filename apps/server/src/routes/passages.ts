import type { FastifyInstance } from "fastify";
import { requireDeviceAuth } from "../services/auth.js";
import type { ApiBibleProxyService, ApiBibleSurface } from "../services/apiBibleProxy.js";
import { handleApiBibleError } from "./bibles.js";
import type { ServerRouteContext } from "./context.js";

interface PassageQuery {
  bibleId: string;
  passageId: string;
  surface?: ApiBibleSurface;
}

export async function registerPassageRoutes(app: FastifyInstance, context: ServerRouteContext & { apiBibleProxy: ApiBibleProxyService }): Promise<void> {
  app.get<{ Querystring: PassageQuery }>("/v1/passages", async (request, reply) => {
    const auth = await requireDeviceAuth(request, reply, context.store, context.tokenPepper, context.now);
    if (!auth) {
      return reply;
    }
    if (!request.query.bibleId || !request.query.passageId) {
      return reply.code(400).send({ error: "missing_bible_or_passage" });
    }
    try {
      return await context.apiBibleProxy.getPassage(auth, {
        bibleId: request.query.bibleId,
        passageId: request.query.passageId,
        surface: request.query.surface === "human" ? "human" : "model"
      });
    } catch (error) {
      return handleApiBibleError(error, reply);
    }
  });
}
