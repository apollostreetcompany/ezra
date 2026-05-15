import { createHmac, randomUUID } from "node:crypto";

export interface FumsReportInput {
  fumsToken: string;
  deviceId: string;
  sessionId: string;
  userIdHash?: string;
}

export function createFumsSessionId(): string {
  return `fums_session_${randomUUID()}`;
}

export function hmacFumsUserId(secret: string, internalUserId: string): string {
  return createHmac("sha256", secret).update(internalUserId).digest("hex");
}

export function buildFumsReportUrl(input: FumsReportInput): string {
  const url = new URL("https://fums.api.bible/f3");
  url.searchParams.append("t", input.fumsToken);
  url.searchParams.set("dId", input.deviceId);
  url.searchParams.set("sId", input.sessionId);
  if (input.userIdHash) {
    url.searchParams.set("uId", input.userIdHash);
  }
  return url.toString();
}
