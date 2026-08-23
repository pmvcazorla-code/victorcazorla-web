import { describe, expect, it } from "vitest";
import {
  classify,
  fileExtension,
  fileName,
} from "../../public/scripts/lib/click-classify.js";

const HOST = "victorcazorla.com";
const BASE = "https://victorcazorla.com/deontologia/";

describe("fileExtension", () => {
  it("returns the lowercased extension", () => {
    expect(fileExtension("/docs/report.PDF")).toBe("pdf");
  });

  it("returns an empty string when there is no extension", () => {
    expect(fileExtension("/deontologia/")).toBe("");
  });
});

describe("fileName", () => {
  it("returns the last path segment", () => {
    expect(fileName("/docs/report.pdf")).toBe("report.pdf");
  });

  it("returns the whole string when there is no slash", () => {
    expect(fileName("report.pdf")).toBe("report.pdf");
  });
});

describe("classify", () => {
  it("treats mailto links as contact clicks regardless of address", () => {
    expect(classify("mailto:contacto@victorcazorla.com", HOST, BASE)).toEqual({ type: "contact" });
  });

  it("treats links ending in a known document extension as downloads", () => {
    expect(
      classify("https://www.herpetologica.org/BAHE/37/BAHE_37.pdf", HOST, BASE)
    ).toEqual({ type: "download", ext: "pdf" });
  });

  it("flags known professional-network domains", () => {
    expect(classify("https://www.linkedin.com/in/victorcazorla-f/", HOST, BASE)).toEqual({
      type: "outbound",
      hostname: "www.linkedin.com",
      professional: true,
    });
    expect(classify("https://orcid.org/0009-0009-7976-9691", HOST, BASE)).toMatchObject({
      professional: true,
    });
  });

  it("flags other external domains as non-professional outbound links", () => {
    expect(classify("https://www.aneca.es", HOST, BASE)).toEqual({
      type: "outbound",
      hostname: "www.aneca.es",
      professional: false,
    });
  });

  it("ignores same-site links", () => {
    expect(classify("/formacion/", HOST, BASE)).toBeNull();
    expect(classify("https://victorcazorla.com/it/", HOST, BASE)).toBeNull();
  });

  it("ignores in-page anchors", () => {
    expect(classify("#main-content", HOST, BASE)).toBeNull();
  });

  it("returns null instead of throwing for an unparsable href", () => {
    expect(classify("not a url and not relative either::", HOST, "not-a-base")).toBeNull();
  });
});
