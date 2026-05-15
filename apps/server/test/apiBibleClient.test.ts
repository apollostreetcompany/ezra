import { describe, expect, it } from "vitest";
import { ApiBibleClient } from "../src/services/apiBibleClient.js";

describe("ApiBibleClient", () => {
  it("uses the configured REST base URL and api-key header", async () => {
    const calls: Array<{ url: string; apiKey: string | null }> = [];
    const client = new ApiBibleClient({
      apiKey: "test-api-key",
      baseUrl: "https://rest.api.bible/v1",
      fetchImpl: async (input, init) => {
        calls.push({ url: String(input), apiKey: new Headers(init?.headers).get("api-key") });
        return new Response(JSON.stringify({ data: [] }), { status: 200, headers: { "content-type": "application/json" } });
      }
    });

    await client.listBibles();

    expect(calls[0]?.url).toContain("https://rest.api.bible/v1/bibles");
    expect(calls[0]?.url).toContain("include-full-details=true");
    expect(calls[0]?.apiKey).toBe("test-api-key");
  });
});
