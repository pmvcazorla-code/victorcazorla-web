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

function makeAi(result: unknown = { response: "Víctor preside el Comité de Ética del COAMB.", data: [] }) {
  const aiSearch = vi.fn(async () => result);
  return { binding: { autorag: vi.fn(() => ({ aiSearch })) }, aiSearch };
}

function makeEnv(overrides: Record<string, unknown> = {}) {
  return {
    AI: makeAi().binding,
    CONTACT_RATE_LIMIT: new FakeKV(),
    HCAPTCHA_SECRET: "secret",
    AI_SEARCH_INSTANCE: "victorcazorla-ai-search",
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

  it("responde y devuelve fuentes cuando el token es válido", async () => {
    const ai = makeAi({
      response: "Es perito judicial ambiental.",
      data: [{ filename: "site/deontologia.md" }, { filename: "site/cienciasambientales.md" }],
    });
    const env = makeEnv({ AI: ai.binding });
    const res = await onRequestPost({
      request: makeRequest({ message: "¿A qué se dedica?", token: "hc-token" }),
      env,
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(body.answer).toBe("Es perito judicial ambiental.");
    expect(body.sources).toEqual([
      { title: "Deontologia", url: "https://victorcazorla.com/deontologia/" },
      { title: "Cienciasambientales", url: "https://victorcazorla.com/cienciasambientales/" },
    ]);
    expect(ai.binding.autorag).toHaveBeenCalledWith("victorcazorla-ai-search");
  });

  it("no vuelve a pedir captcha una vez superado (pase en KV)", async () => {
    const env = makeEnv();
    await onRequestPost({ request: makeRequest({ message: "Primera", token: "hc-token" }), env });
    const res = await onRequestPost({ request: makeRequest({ message: "Segunda" }), env });
    expect(res.status).toBe(200);
  });

  it("rechaza un token de captcha inválido", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ success: false }), { status: 200 }))
    );
    const res = await onRequestPost({
      request: makeRequest({ message: "Hola", token: "malo" }),
      env: makeEnv(),
    });
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ error: "captcha" });
  });

  it("valida el mensaje", async () => {
    const short = await onRequestPost({ request: makeRequest({ message: "a" }), env: makeEnv() });
    expect(short.status).toBe(400);
    expect(await short.json()).toMatchObject({ error: "empty" });

    const long = await onRequestPost({
      request: makeRequest({ message: "x".repeat(501), token: "hc-token" }),
      env: makeEnv(),
    });
    expect(long.status).toBe(400);
    expect(await long.json()).toMatchObject({ error: "too_long" });
  });

  it("aplica rate-limit por IP a la hora", async () => {
    const env = makeEnv();
    env.CONTACT_RATE_LIMIT.store.set(`chat:captcha-ok:203.0.113.5`, "1");
    for (let i = 0; i < 15; i++) {
      const ok = await onRequestPost({ request: makeRequest({ message: `pregunta ${i}` }), env });
      expect(ok.status).toBe(200);
    }
    const blocked = await onRequestPost({ request: makeRequest({ message: "una más" }), env });
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toMatchObject({ error: "rate_limited" });
  });

  it("devuelve 502 si AI Search falla", async () => {
    const failing = { autorag: () => ({ aiSearch: async () => { throw new Error("upstream"); } }) };
    const res = await onRequestPost({
      request: makeRequest({ message: "Hola", token: "hc-token" }),
      env: makeEnv({ AI: failing as never }),
    });
    expect(res.status).toBe(502);
  });
});
