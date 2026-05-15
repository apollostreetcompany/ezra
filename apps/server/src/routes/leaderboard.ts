import type { FastifyInstance } from "fastify";
import { requireDeviceAuth } from "../services/auth.js";
import type { LeaderboardProfileInput } from "../services/sync.js";
import type { ServerRouteContext } from "./context.js";

interface LeaderboardQuery {
  limit?: string;
}

export async function registerLeaderboardRoutes(app: FastifyInstance, context: ServerRouteContext): Promise<void> {
  app.get<{ Querystring: LeaderboardQuery }>("/v1/leaderboard", async (request, reply) => {
    const auth = await requireDeviceAuth(request, reply, context.store, context.tokenPepper, context.now);
    if (!auth) {
      return reply;
    }
    return { entries: context.store.listLeaderboardEntries(readLimit(request.query.limit)) };
  });

  app.get("/v1/leaderboard/profile", async (request, reply) => {
    const auth = await requireDeviceAuth(request, reply, context.store, context.tokenPepper, context.now);
    if (!auth) {
      return reply;
    }
    return { profile: publicProfile(context.store.getLeaderboardProfile(auth, context.now())) };
  });

  app.put<{ Body: LeaderboardProfileInput }>("/v1/leaderboard/profile", async (request, reply) => {
    const auth = await requireDeviceAuth(request, reply, context.store, context.tokenPepper, context.now);
    if (!auth) {
      return reply;
    }
    if (request.body.optedIn === true && !request.body.displayName?.trim()) {
      return reply.code(400).send({ error: "display_name_required" });
    }
    const profile = context.store.setLeaderboardProfile(auth, request.body, context.now());
    return { profile: publicProfile(profile) };
  });
}

function readLimit(value: string | undefined): number {
  if (value === undefined) {
    return 25;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return 25;
  }
  return Math.min(parsed, 100);
}

function publicProfile(profile: { optedIn: boolean; displayName: string; updatedAt: string }): { optedIn: boolean; displayName: string; updatedAt: string } {
  return { optedIn: profile.optedIn, displayName: profile.displayName, updatedAt: profile.updatedAt };
}
