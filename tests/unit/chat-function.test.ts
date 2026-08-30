import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { onRequestPost } from "../../functions/api/chat";

class FakeKV {
  store = new Map<string, string>();
  async get(key: string) {
    return this.store.get(key) ?? null;
  }
  async put(key: string, value: string) {
    this.store.set(key, value);
  }
}

const CAPTCHA_URL = "https://api.hcaptcha.com/siteverify";

function makeAiRun(response = "Víctor preside el Comité de Ética del COAMB.") {
  return vi.fn(async () => ({ response }));
}

function makeEnv(overrides: Record<string, unknown> = {}) {
  return {
    AI: { run: makeAiRun() },
    CONTACT_RATE_LIMIT: new FakeKV(),
    HCAPTCHA_SECRET: "secret",
    AI_GATEWAY_ID: "victorcazorla-ai",
    CHAT_MODEL: "@cf/meta/llama-3.1-8b-instruct-fast",
    CHAT_MODEL_FALLBACK: "@cf/qwen/qwen3.8-27b",
    ...overrides,
  } as never;
}

function makeRequest(body: Record<string, unknown>, ip = "203.0.113.5") {
  return new Request("https://victorcazorla.com/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", "CF-Connecting-IP": ip },
    body: JSON.stringify(body),
  });
}

describe("onRequestPost /api/chat", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === CAPTCHA_URL) return new Response(JSON.stringify({ success: true }), { status: 200 });
        throw new Error(`Unexpected fetch to ${url}`);
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("pide captcha en el primer mensaje sin token", async () => {
    const res = await onRequestPost({ request: makeRequest({ message: "¿Quién es Víctor Cazorla?" }), env: makeEnv() });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ ok: false, error: "captcha_required" });
  });

  it("responde y adjunta fuentes cuando el token es válido", async () => {
    const run = makeAiRun("Es perito judicial ambiental.");
    const env = makeEnv({ AI: { run } });
    const res = await onRequestPost({
      request: makeRequest({ message: "¿Quién preside el comité de deontología del COAMB?", token: "hc" }),
      env,
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; answer: string; sources: { title: string; url: string }[] };
    expect(body.ok).toBe(true);
    expect(body.answer).toBe("Es perito judicial ambiental.");
    expect(body.sources.length).toBeGreaterThan(0);
    expect(body.sources.every((s) => s.url && s.url.startsWith("https://victorcazorla.com/"))).toBe(true);
    // No expone el resumen de perfil como "fuente".
    expect(body.sources.some((s) => /llms\.txt/.test(s.url))).toBe(false);

    // Llama a Workers AI a través del AI Gateway configurado.
    expect(run).toHaveBeenCalledTimes(1);
    const [model, input, options] = run.mock.calls[0];
    expect(model).toBe("@cf/meta/llama-3.1-8b-instruct-fast");
    expect(options).toEqual({ gateway: { id: "victorcazorla-ai", collectLog: true } });
    expect((input as { messages: unknown[] }).messages).toHaveLength(2);
  });

  it("reintenta con el modelo de fallback si el primario falla (p. ej. 410)", async () => {
    const run = vi
      .fn()
      .mockRejectedValueOnce(new Error("410 Gone"))
      .mockResolvedValueOnce({ response: "Respuesta del fallback." });
    const res = await onRequestPost({
      request: makeRequest({ message: "¿A qué se dedica Víctor Cazorla?", token: "hc" }),
      env: makeEnv({ AI: { run } }),
    });
    expect(res.status).toBe(200);
    expect((await res.json() as { answer: string }).answer).toBe("Respuesta del fallback.");
    expect(run.mock.calls.map((c) => c[0])).toEqual([
      "@cf/meta/llama-3.1-8b-instruct-fast",
      "@cf/qwen/qwen3.8-27b",
    ]);
  });

  it("descarta el bloque <think> de los modelos con reasoning", async () => {
    const run = vi.fn(async () => ({
      response: "<think>El usuario pregunta por su cargo.</think>Preside el Comité de Ética del COAMB.",
    }));
    const res = await onRequestPost({
      request: makeRequest({ message: "¿Qué cargo tiene en el COAMB?", token: "hc" }),
      env: makeEnv({ AI: { run } }),
    });
    expect((await res.json() as { answer: string }).answer).toBe("Preside el Comité de Ética del COAMB.");
  });

  it("no vuelve a pedir captcha una vez superado (pase en KV)", async () => {
    const env = makeEnv();
    await onRequestPost({ request: makeRequest({ message: "Primera pregunta", token: "hc" }), env });
    const res = await onRequestPost({ request: makeRequest({ message: "Segunda pregunta" }), env });
    expect(res.status).toBe(200);
  });

  it("rechaza un token de captcha inválido", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ success: false }), { status: 200 })));
    const res = await onRequestPost({ request: makeRequest({ message: "Hola", token: "malo" }), env: makeEnv() });
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ error: "captcha" });
  });

  it("valida el mensaje", async () => {
    const short = await onRequestPost({ request: makeRequest({ message: "a" }), env: makeEnv() });
    expect(short.status).toBe(400);
    expect(await short.json()).toMatchObject({ error: "empty" });

    const long = await onRequestPost({
      request: makeRequest({ message: "x".repeat(501), token: "hc" }),
      env: makeEnv(),
    });
    expect(long.status).toBe(400);
    expect(await long.json()).toMatchObject({ error: "too_long" });
  });

  it("aplica rate-limit por IP a la hora", async () => {
    const env = makeEnv();
    env.CONTACT_RATE_LIMIT.store.set("chat:captcha-ok:203.0.113.5", "1");
    for (let i = 0; i < 15; i++) {
      const ok = await onRequestPost({ request: makeRequest({ message: `pregunta numero ${i}` }), env });
      expect(ok.status).toBe(200);
    }
    const blocked = await onRequestPost({ request: makeRequest({ message: "una mas" }), env });
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toMatchObject({ error: "rate_limited" });
  });

  it("devuelve 502 si Workers AI falla", async () => {
    const res = await onRequestPost({
      request: makeRequest({ message: "Hola", token: "hc" }),
      env: makeEnv({ AI: { run: async () => { throw new Error("capacity"); } } }),
    });
    expect(res.status).toBe(502);
  });

  it("devuelve 502 si el modelo responde vacío", async () => {
    const res = await onRequestPost({
      request: makeRequest({ message: "Hola", token: "hc" }),
      env: makeEnv({ AI: { run: async () => ({ response: "  " }) } }),
    });
    expect(res.status).toBe(502);
  });
});
