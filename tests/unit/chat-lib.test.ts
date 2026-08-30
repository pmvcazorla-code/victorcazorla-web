import { describe, expect, it } from "vitest";
import {
  validateMessage,
  chatRateLimitKeys,
  captchaPassKey,
  siteUrlForKey,
  extractSources,
  MESSAGE_MAX_LENGTH,
} from "../../functions/_lib/chat";

describe("validateMessage", () => {
  it("acepta y normaliza espacios", () => {
    expect(validateMessage("  ¿Quién   es   Víctor? ")).toEqual({
      valid: true,
      value: "¿Quién es Víctor?",
    });
  });

  it("rechaza vacío o casi vacío", () => {
    expect(validateMessage("")).toEqual({ valid: false, error: "empty" });
    expect(validateMessage("  ")).toEqual({ valid: false, error: "empty" });
    expect(validateMessage("a")).toEqual({ valid: false, error: "empty" });
    expect(validateMessage(42)).toEqual({ valid: false, error: "empty" });
  });

  it("rechaza mensajes por encima del máximo", () => {
    expect(validateMessage("x".repeat(MESSAGE_MAX_LENGTH + 1))).toEqual({
      valid: false,
      error: "too_long",
    });
  });
});

describe("chatRateLimitKeys", () => {
  it("deriva claves estables por ventana de hora y día", () => {
    const t = Date.parse("2026-08-30T12:34:00Z");
    const a = chatRateLimitKeys("203.0.113.9", t);
    const b = chatRateLimitKeys("203.0.113.9", t + 5 * 60 * 1000);
    expect(a).toEqual(b);
    expect(a.hourKey).toMatch(/^chat:rl:h:203\.0\.113\.9:\d+$/);
    expect(a.dayKey).toMatch(/^chat:rl:d:203\.0\.113\.9:\d+$/);

    const later = chatRateLimitKeys("203.0.113.9", t + 2 * 60 * 60 * 1000);
    expect(later.hourKey).not.toBe(a.hourKey);
  });
});

describe("captchaPassKey", () => {
  it("va namespaced por IP", () => {
    expect(captchaPassKey("1.2.3.4")).toBe("chat:captcha-ok:1.2.3.4");
  });
});

describe("siteUrlForKey", () => {
  it("reconstruye la URL pública de las páginas del sitio", () => {
    expect(siteUrlForKey("site/home.md")).toBe("https://victorcazorla.com/");
    expect(siteUrlForKey("site/perfil-resumen.md")).toBe("https://victorcazorla.com/");
    expect(siteUrlForKey("site/formacion.md")).toBe("https://victorcazorla.com/formacion/");
    expect(siteUrlForKey("site/en/ethics.md")).toBe("https://victorcazorla.com/en/ethics/");
  });

  it("devuelve null para material curado sin URL canónica", () => {
    expect(siteUrlForKey("curated/entrevista-coamb.md")).toBeNull();
  });
});

describe("extractSources", () => {
  it("deduplica por filename, respeta el orden y limita el número", () => {
    const data = [
      { filename: "site/deontologia.md", score: 0.9 },
      { filename: "site/deontologia.md", score: 0.8 },
      { filename: "site/formacion.md", score: 0.7 },
      { filename: "curated/prensa.md", score: 0.6, attributes: { title: "Entrevista COAMB" } },
      { filename: "site/it.md", score: 0.5 },
      { filename: "site/legal.md", score: 0.4 },
    ];
    const sources = extractSources(data, 4);
    expect(sources).toEqual([
      { title: "Deontologia", url: "https://victorcazorla.com/deontologia/" },
      { title: "Formacion", url: "https://victorcazorla.com/formacion/" },
      { title: "Entrevista COAMB", url: null },
      { title: "It", url: "https://victorcazorla.com/it/" },
    ]);
  });

  it("tolera entradas no-array o vacías", () => {
    expect(extractSources(undefined)).toEqual([]);
    expect(extractSources({})).toEqual([]);
    expect(extractSources([{ score: 1 }])).toEqual([]);
  });
});
