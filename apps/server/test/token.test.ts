import { describe, expect, it } from "vitest";
import { generateDeviceToken, hashDeviceToken, tokenPreview } from "../src/services/token.js";

describe("device token service", () => {
  it("generates opaque live tokens and hashes with pepper", () => {
    const generated = generateDeviceToken("pepper-a");

    expect(generated.token).toMatch(/^bc_live_[0-9a-f]{8}_[A-Za-z0-9_-]+$/);
    expect(generated.tokenHash).toBe(hashDeviceToken(generated.token, "pepper-a"));
    expect(generated.tokenHash).not.toBe(hashDeviceToken(generated.token, "pepper-b"));
    expect(generated.tokenHash).not.toContain(generated.token);
    expect(tokenPreview(generated.token)).toBe(`bc_live_${generated.tokenPrefix}_...`);
  });
});
