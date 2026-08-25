import { describe, expect, it } from "vitest";
import { toHtmlEntities } from "../../src/utils/obfuscate";

describe("toHtmlEntities", () => {
  it("converts every character to a decimal HTML entity", () => {
    expect(toHtmlEntities("ab")).toBe("&#97;&#98;");
  });

  it("round-trips through entity decoding back to the original string", () => {
    const address = "contacto@victorcazorla.com";
    const encoded = toHtmlEntities(address);
    const decoded = encoded.replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
    expect(decoded).toBe(address);
  });

  it("contains no plain-text @ or . that a naive scraper could regex for", () => {
    const encoded = toHtmlEntities("investigacion@victorcazorla.com");
    expect(encoded).not.toContain("@");
    expect(encoded).not.toMatch(/[a-z]/i);
  });
});
