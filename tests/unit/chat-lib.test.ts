import { describe, expect, it } from "vitest";
import {
  validateMessage,
  chatRateLimitKeys,
  captchaPassKey,
  buildMessages,
  toSource,
  MESSAGE_MAX_LENGTH,
  SYSTEM_PROMPT,
} from "../../functions/_lib/chat";
import type { KbDoc } from "../../functions/_lib/kb-search";

const doc = (over: Partial<KbDoc> = {}): KbDoc => ({
  id: "site/deontologia",
  title: "Deontología",
  url: "https://victorcazorla.com/deontologia/",
  lang: "es",
  source: "Sitio web oficial",
  text: "Preside el Comité de Ética del COAMB desde 2025.",
  ...over,
});

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
    expect(a).toEqual(chatRateLimitKeys("203.0.113.9", t + 5 * 60 * 1000));
    expect(a.hourKey).toMatch(/^chat:rl:h:203\.0\.113\.9:\d+$/);
    expect(a.dayKey).toMatch(/^chat:rl:d:203\.0\.113\.9:\d+$/);
    expect(chatRateLimitKeys("203.0.113.9", t + 2 * 60 * 60 * 1000).hourKey).not.toBe(a.hourKey);
  });
});

describe("captchaPassKey", () => {
  it("va namespaced por IP", () => {
    expect(captchaPassKey("1.2.3.4")).toBe("chat:captcha-ok:1.2.3.4");
  });
});

describe("toSource", () => {
  it("proyecta título y url del documento", () => {
    expect(toSource(doc())).toEqual({
      title: "Deontología",
      url: "https://victorcazorla.com/deontologia/",
    });
    expect(toSource(doc({ url: null }))).toEqual({ title: "Deontología", url: null });
  });
});

describe("buildMessages", () => {
  it("mete las instrucciones y la ficha en el system; el user es solo la pregunta", () => {
    const messages = buildMessages("¿Preside algún comité?", [
      doc(),
      doc({ id: "site/home", title: "Perfil", url: "https://victorcazorla.com/" }),
    ]);
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain(SYSTEM_PROMPT);
    expect(messages[0].content).toContain("## Deontología — https://victorcazorla.com/deontologia/");
    expect(messages[0].content).toContain("Comité de Ética del COAMB");
    expect(messages[1]).toEqual({ role: "user", content: "¿Preside algún comité?" });
  });

  it("prohíbe al modelo mencionar el contexto / la información proporcionada", () => {
    const flat = SYSTEM_PROMPT.replace(/\s+/g, " ").toLowerCase();
    expect(flat).toContain("nunca menciones");
    expect(flat).toContain("según la información proporcionada");
  });

  it("recorta documentos largos en la ficha", () => {
    const long = doc({ text: "hola ".repeat(2000) });
    const [system] = buildMessages("test", [long]);
    expect(system.content).toContain("…");
  });
});
