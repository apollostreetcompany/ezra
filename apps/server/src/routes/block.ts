import type { FastifyInstance } from "fastify";
import { requireDeviceAuth } from "../services/auth.js";
import type { BlockSettingsInput, PrayerAttestationInput } from "../services/sync.js";
import type { ServerRouteContext } from "./context.js";

export async function registerBlockRoutes(app: FastifyInstance, context: ServerRouteContext): Promise<void> {
  app.get("/v1/block/entitlement", async (request, reply) => {
    const auth = await requireDeviceAuth(request, reply, context.store, context.tokenPepper, context.now);
    if (!auth) {
      return reply;
    }
    return {
      premium: context.store.hasPremium(auth.userId),
      mode: "soft-local",
      graceDays: 7,
      attestation: "I have prayed",
      disclaimer: "Prayer Gate is a personal attestation. Bible Coder cannot verify private prayer and does not pray on your behalf."
    };
  });

  app.get("/v1/block/settings", async (request, reply) => {
    const auth = await requireDeviceAuth(request, reply, context.store, context.tokenPepper, context.now);
    if (!auth) {
      return reply;
    }
    return { settings: context.store.getBlockSettings(auth, context.now()) };
  });

  app.put<{ Body: BlockSettingsInput }>("/v1/block/settings", async (request, reply) => {
    const auth = await requireDeviceAuth(request, reply, context.store, context.tokenPepper, context.now);
    if (!auth) {
      return reply;
    }
    if (request.body.enabled === true && !context.store.hasPremium(auth.userId)) {
      return reply.code(403).send({ error: "premium_required" });
    }
    return { settings: context.store.setBlockSettings(auth, request.body, context.now()) };
  });

  app.post<{ Body: PrayerAttestationInput }>("/v1/prayer-attestations", async (request, reply) => {
    const auth = await requireDeviceAuth(request, reply, context.store, context.tokenPepper, context.now);
    if (!auth) {
      return reply;
    }
    const settings = context.store.getBlockSettings(auth, context.now());
    if (!settings.syncAttestations) {
      return reply.code(409).send({ error: "attestation_sync_disabled" });
    }
    if (!request.body.occurredAt || !request.body.repoHash) {
      return reply.code(400).send({ error: "missing_attestation_metadata" });
    }
    const attestation = context.store.recordPrayerAttestation(auth, request.body);
    return reply.code(201).send({ attestation });
  });
}
