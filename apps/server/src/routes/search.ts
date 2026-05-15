import type { FastifyInstance } from "fastify";
import { requireDeviceAuth } from "../services/auth.js";
import type { ApiBibleProxyService, ApiBibleSurface } from "../services/apiBibleProxy.js";
import { handleApiBibleError } from "./bibles.js";
import type { ServerRouteContext } from "./context.js";

interface SearchQuery {
  bibleId: string;
  query: string;
  surface?: ApiBibleSurface;
  limit?: string;
  offset?: string;
}

export async function registerSearchRoutes(app: FastifyInstance, context: ServerRouteContext & { apiBibleProxy: ApiBibleProxyService }): Promise<void> {
  app.get<{ Querystring: SearchQuery }>("/v1/search", async (request, reply) => {
    const auth = await requireDeviceAuth(request, reply, context.store, context.tokenPepper, context.now);
    if (!auth) {
      return reply;
    }
    if (!request.query.bibleId || !request.query.query) {
      return reply.code(400).send({ error: "missing_bible_or_query" });
    }
    try {
      const searchInput: Parameters<ApiBibleProxyService["search"]>[1] = {
        bibleId: request.query.bibleId,
        query: request.query.query,
        surface: request.query.surface === "human" ? "human" : "model"
      };
      const limit = readOptionalInteger(request.query.limit);
      const offset = readOptionalInteger(request.query.offset);
      if (limit !== undefined) {
        searchInput.limit = limit;
      }
      if (offset !== undefined) {
        searchInput.offset = offset;
      }
      return await context.apiBibleProxy.search(auth, searchInput);
    } catch (error) {
      return handleApiBibleError(error, reply);
    }
  });
}

function readOptionalInteger(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}
