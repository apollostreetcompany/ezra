import { describe, expect, it } from "vitest";
import { formatReference, parseReference, referenceId } from "../src/references/parser.js";

describe("parseReference", () => {
  it("parses a single verse with common alias", () => {
    const parsed = parseReference("Jn 3:16");
    expect(parsed.book.id).toBe("john");
    expect(parsed.startChapter).toBe(3);
    expect(parsed.startVerse).toBe(16);
    expect(formatReference(parsed)).toBe("John 3:16");
    expect(referenceId(parsed)).toBe("john.3.16-3.16");
  });

  it("parses verse ranges", () => {
    const parsed = parseReference("John 3:16-17");
    expect(parsed.endVerse).toBe(17);
    expect(formatReference(parsed)).toBe("John 3:16-3:17");
  });

  it("parses multi-chapter ranges", () => {
    const parsed = parseReference("Genesis 1:1-2:3");
    expect(parsed.book.id).toBe("genesis");
    expect(parsed.endChapter).toBe(2);
    expect(parsed.endVerse).toBe(3);
  });

  it("parses whole-chapter ranges", () => {
    const parsed = parseReference("John 3-4");
    expect(parsed.book.id).toBe("john");
    expect(parsed.startChapter).toBe(3);
    expect(parsed.startVerse).toBeUndefined();
    expect(parsed.endChapter).toBe(4);
    expect(parsed.endVerse).toBeUndefined();
    expect(formatReference(parsed)).toBe("John 3-4");
  });

  it("parses numbered books", () => {
    expect(parseReference("1 John 1:1").book.id).toBe("1-john");
  });

  it("rejects unknown books", () => {
    expect(() => parseReference("Hezekiah 1:1")).toThrow(/Unknown Bible book/);
  });
});
