import { buildServer } from "../apps/server/src/server.js";
import { InMemorySyncStore } from "../apps/server/src/services/sync.js";

const required = ["API_BIBLE_KEY", "BIBLE_CODER_ALLOWED_PREMIUM_BIBLES", "FUMS_USER_HASH_SECRET"];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const store = new InMemorySyncStore();
const app = await buildServer({
  store,
  tokenPepper: process.env.TOKEN_HASH_PEPPER ?? "local-live-smoke-token-pepper",
  env: {
    ...process.env,
    BIBLE_CODER_ENABLE_PREMIUM_API_BIBLE: "true",
    BIBLE_CODER_CACHE_MODE: process.env.BIBLE_CODER_CACHE_MODE ?? "metadata-only",
    BIBLE_CODER_CACHE_TTL_DAYS: process.env.BIBLE_CODER_CACHE_TTL_DAYS ?? "14"
  },
  now: () => new Date().toISOString()
});

try {
  const issued = await app.inject({
    method: "POST",
    url: "/v1/device-tokens",
    payload: { deviceName: "live-api-bible-smoke" }
  });
  if (issued.statusCode !== 201) {
    throw new Error(`Device token issue failed with status ${issued.statusCode}`);
  }
  const device = issued.json() as { token: string; userId: string };
  store.grantPremium(device.userId);
  const headers = { authorization: `Bearer ${device.token}` };
  const bibleId = process.env.BIBLE_CODER_ALLOWED_PREMIUM_BIBLES?.split(",").map((value) => value.trim()).filter(Boolean)[0];
  if (!bibleId) {
    throw new Error("No allowed Bible ID configured.");
  }

  const bibles = await app.inject({ method: "GET", url: "/v1/bibles", headers });
  const passage = await app.inject({
    method: "GET",
    url: `/v1/passages?bibleId=${encodeURIComponent(bibleId)}&passageId=JHN.3.16&surface=human`,
    headers
  });
  const modelPassage = await app.inject({
    method: "GET",
    url: `/v1/passages?bibleId=${encodeURIComponent(bibleId)}&passageId=JHN.3.16`,
    headers
  });

  const passageBody = passage.json() as { reference?: string; verseCount?: number; copyright?: string; fums?: { tokenCaptured?: boolean }; content?: string | null };
  const modelBody = modelPassage.json() as { content?: string | null; policy?: { textRedacted?: boolean } };
  const summary = {
    biblesStatus: bibles.statusCode,
    allowedBiblesReturned: Array.isArray((bibles.json() as { bibles?: unknown[] }).bibles)
      ? ((bibles.json() as { bibles?: unknown[] }).bibles ?? []).length
      : 0,
    passageStatus: passage.statusCode,
    reference: passageBody.reference,
    verseCount: passageBody.verseCount,
    copyrightPresent: Boolean(passageBody.copyright),
    fumsTokenCaptured: Boolean(passageBody.fums?.tokenCaptured),
    humanContentReturned: Boolean(passageBody.content),
    modelStatus: modelPassage.statusCode,
    modelTextRedacted: modelBody.content === null && modelBody.policy?.textRedacted === true
  };

  if (summary.biblesStatus !== 200 || summary.passageStatus !== 200 || summary.modelStatus !== 200) {
    throw new Error(`Unexpected API smoke status: ${JSON.stringify(summary)}`);
  }
  if (!summary.reference || !summary.copyrightPresent || !summary.fumsTokenCaptured || !summary.humanContentReturned || !summary.modelTextRedacted) {
    throw new Error(`API smoke policy check failed: ${JSON.stringify(summary)}`);
  }
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await app.close();
}
