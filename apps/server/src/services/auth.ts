import type { FastifyReply, FastifyRequest } from "fastify";
import type { DeviceAuth, InMemorySyncStore } from "./sync.js";

export interface AuthContext {
  auth: DeviceAuth;
}

export function bearerToken(request: FastifyRequest): string | undefined {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return undefined;
  }
  return header.slice("Bearer ".length).trim();
}

export async function requireDeviceAuth(
  request: FastifyRequest,
  reply: FastifyReply,
  store: InMemorySyncStore,
  pepper: string,
  now: () => string,
): Promise<DeviceAuth | undefined> {
  const token = bearerToken(request);
  if (!token) {
    await reply.code(401).send({ error: "missing_bearer_token" });
    return undefined;
  }
  const auth = store.authenticate(token, pepper, now());
  if (!auth) {
    await reply.code(401).send({ error: "invalid_or_revoked_token" });
    return undefined;
  }
  return auth;
}
