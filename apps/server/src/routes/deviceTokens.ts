import type { FastifyInstance } from "fastify";
import { bearerToken } from "../services/auth.js";
import type { ServerRouteContext } from "./context.js";

interface DeviceTokenBody {
  deviceName?: string;
  scopes?: string[];
}

export async function registerDeviceTokenRoutes(app: FastifyInstance, context: ServerRouteContext): Promise<void> {
  app.post<{ Body: DeviceTokenBody }>("/v1/device-tokens", async (request, reply) => {
    const now = context.now();
    const token = bearerToken(request);
    const existingAuth = token ? context.store.authenticate(token, context.tokenPepper, now) : undefined;
    if (token && !existingAuth) {
      return reply.code(401).send({ error: "invalid_or_revoked_token" });
    }
    const tokenInput: Parameters<typeof context.store.createDeviceToken>[0] = {
      pepper: context.tokenPepper,
      now
    };
    if (request.body?.deviceName !== undefined) {
      tokenInput.deviceName = request.body.deviceName;
    }
    if (request.body?.scopes !== undefined) {
      tokenInput.scopes = request.body.scopes;
    }
    if (existingAuth?.userId !== undefined) {
      tokenInput.userId = existingAuth.userId;
    }
    const issued = context.store.createDeviceToken(tokenInput);
    return reply.code(201).send({
      token: issued.token,
      tokenPrefix: issued.record.tokenPrefix,
      userId: issued.record.userId,
      deviceId: issued.record.deviceId,
      scopes: issued.record.scopes,
      createdAt: issued.record.createdAt
    });
  });
}
