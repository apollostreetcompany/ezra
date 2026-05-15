import { createHash, randomBytes } from "node:crypto";

export interface GeneratedDeviceToken {
  token: string;
  tokenPrefix: string;
  tokenHash: string;
}

export function generateDeviceToken(pepper: string): GeneratedDeviceToken {
  const tokenPrefix = randomBytes(4).toString("hex");
  const secret = randomBytes(32).toString("base64url");
  const token = `bc_live_${tokenPrefix}_${secret}`;
  return { token, tokenPrefix, tokenHash: hashDeviceToken(token, pepper) };
}

export function hashDeviceToken(token: string, pepper: string): string {
  return createHash("sha256").update(pepper).update("\0").update(token).digest("hex");
}

export function tokenPreview(token: string): string {
  const [scheme, kind, prefix] = token.split("_");
  return scheme && kind && prefix ? `${scheme}_${kind}_${prefix}_...` : "bc_live_...";
}
