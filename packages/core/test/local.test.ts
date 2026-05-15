import { describe, expect, it } from "vitest";
import { getLocalPassage } from "../src/translations/local.js";

describe("local Bible loader", () => {
  it("loads WEB local sample text without API.Bible", () => {
    const passage = getLocalPassage("John 3:16", "web");
    expect(passage.verses[0]?.text).toContain("For God so loved");
    expect(passage.attribution).toContain("World English Bible");
  });

  it("loads KJV local sample text without API.Bible", () => {
    const passage = getLocalPassage("John 3:16", "kjv");
    expect(passage.verses[0]?.text).toContain("only begotten Son");
  });
});
