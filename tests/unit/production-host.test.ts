import { describe, expect, it } from "vitest";
import { isProductionHost, isLocalHost } from "../../public/scripts/lib/production-host.js";

describe("isLocalHost", () => {
  it("solo es true para localhost / 127.0.0.1 / [::1]", () => {
    expect(isLocalHost("localhost")).toBe(true);
    expect(isLocalHost("127.0.0.1")).toBe(true);
    expect(isLocalHost("[::1]")).toBe(true);
    expect(isLocalHost("victorcazorla.com")).toBe(false);
    expect(isLocalHost("victorcazorla-web.pages.dev")).toBe(false);
  });
});

describe("isProductionHost", () => {
  it("es true para el dominio real y sus alias", () => {
    expect(isProductionHost("victorcazorla.com")).toBe(true);
    expect(isProductionHost("www.victorcazorla.com")).toBe(true);
    expect(isProductionHost("victorcazorla.es")).toBe(true);
  });

  it("es false en desarrollo local", () => {
    expect(isProductionHost("localhost")).toBe(false);
    expect(isProductionHost("127.0.0.1")).toBe(false);
    expect(isProductionHost("[::1]")).toBe(false);
  });

  it("es false para las previews y el alias de Cloudflare Pages", () => {
    expect(isProductionHost("victorcazorla-web.pages.dev")).toBe(false);
    expect(isProductionHost("a1b2c3d4.victorcazorla-web.pages.dev")).toBe(false);
  });
});
