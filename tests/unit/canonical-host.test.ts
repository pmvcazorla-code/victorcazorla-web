import { describe, expect, it } from "vitest";
import { resolveHostAction } from "../../functions/_lib/canonical-host";

describe("resolveHostAction", () => {
  it("deja pasar el dominio real y sus alias sin tocar", () => {
    expect(resolveHostAction("victorcazorla.com", "/deontologia/")).toEqual({ type: "pass" });
    expect(resolveHostAction("www.victorcazorla.com", "/")).toEqual({ type: "pass" });
    expect(resolveHostAction("victorcazorla.es", "/")).toEqual({ type: "pass" });
  });

  it("redirige 301 el alias de producción .pages.dev al dominio canónico, conservando ruta y query", () => {
    expect(resolveHostAction("victorcazorla-web.pages.dev", "/formacion/?utm_source=x")).toEqual({
      type: "redirect",
      location: "https://victorcazorla.com/formacion/?utm_source=x",
    });
    expect(resolveHostAction("victorcazorla-web.pages.dev", "/")).toEqual({
      type: "redirect",
      location: "https://victorcazorla.com/",
    });
  });

  it("marca noindex las preview de rama, pero las deja servir", () => {
    expect(resolveHostAction("a1b2c3d4.victorcazorla-web.pages.dev", "/")).toEqual({ type: "noindex" });
    expect(resolveHostAction("fix-algo.victorcazorla-web.pages.dev", "/en/ethics/")).toEqual({ type: "noindex" });
  });
});
