import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { onRequestPost } from "../../functions/api/contact";

class FakeKV {
  store = new Map<string, string>();
  async get(key: string) {
    return this.store.get(key) ?? null;
  }
  async put(key: string, value: string) {
    this.store.set(key, value);
  }
}

const ENV_BASE = {
  RESEND_API_KEY: "test-key",
  CONTACT_TO_EMAIL: "contacto@victorcazorla.com",
  CONTACT_FROM_EMAIL: "web@victorcazorla.com",
  HCAPTCHA_SECRET: "test-hcaptcha-secret",
};

function makeRequest(body: Record<string, unknown>, ip = "203.0.113.1") {
  return new Request("https://victorcazorla.com/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json", "CF-Connecting-IP": ip },
    body: JSON.stringify(body),
  });
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    name: "Ana García",
    email: "ana@example.com",
    reason: "academic",
    message: "Hola, quería consultar sobre una colaboración.",
    company: "",
    consent: true,
    ts: Date.now() - 3000,
    lang: "es",
    "h-captcha-response": "valid-token",
    ...overrides,
  };
}

const CAPTCHA_URL = "https://api.hcaptcha.com/siteverify";
const RESEND_URL = "https://api.resend.com/emails";

// Por defecto, tanto la verificación de hCaptcha como cualquier envío a
// Resend (notificación + confirmación) tienen éxito; cada test
// sobreescribe solo la rama que le interesa fallar.
function makeFetchMock(overrides: { captchaOk?: boolean; resendOk?: boolean } = {}) {
  const { captchaOk = true, resendOk = true } = overrides;
  return vi.fn(async (url: string) => {
    if (url === CAPTCHA_URL) {
      return new Response(JSON.stringify({ success: captchaOk }), { status: 200 });
    }
    if (url === RESEND_URL) {
      return resendOk
        ? new Response(JSON.stringify({ id: "49a3999c-0ce1-4ea6-ab68-afcd6dc2e794" }), { status: 200 })
        : new Response(JSON.stringify({ name: "validation_error" }), { status: 422 });
    }
    throw new Error(`Unexpected fetch to ${url}`);
  });
}

describe("onRequestPost /api/contact", () => {
  let fetchMock: ReturnType<typeof makeFetchMock>;

  beforeEach(() => {
    fetchMock = makeFetchMock();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("verifies the captcha, sends the notification and the confirmation email, and returns ok:true", async () => {
    const kv = new FakeKV();
    const response = await onRequestPost({ request: makeRequest(validBody()), env: { ...ENV_BASE, CONTACT_RATE_LIMIT: kv } });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });

    const captchaCalls = fetchMock.mock.calls.filter(([url]) => url === CAPTCHA_URL);
    expect(captchaCalls).toHaveLength(1);
    const captchaParams = new URLSearchParams(captchaCalls[0][1].body);
    expect(captchaParams.get("secret")).toBe("test-hcaptcha-secret");
    expect(captchaParams.get("response")).toBe("valid-token");

    const resendCalls = fetchMock.mock.calls.filter(([url]) => url === RESEND_URL);
    expect(resendCalls).toHaveLength(2);
    const bodies = resendCalls.map(([, init]) => JSON.parse(init.body));
    const notification = bodies.find((b) => b.to === "contacto@victorcazorla.com");
    const confirmation = bodies.find((b) => b.to === "ana@example.com");
    expect(notification.reply_to).toBe("Ana García <ana@example.com>");
    expect(confirmation.subject).toBe("Confirmación de recepción - Víctor Cazorla");
  });

  it("localizes the confirmation email to the form's language", async () => {
    const kv = new FakeKV();
    await onRequestPost({ request: makeRequest(validBody({ lang: "en" })), env: { ...ENV_BASE, CONTACT_RATE_LIMIT: kv } });

    const confirmation = fetchMock.mock.calls
      .filter(([url]) => url === RESEND_URL)
      .map(([, init]) => JSON.parse(init.body))
      .find((b) => b.to === "ana@example.com");
    expect(confirmation.subject).toBe("Message received - Víctor Cazorla");
  });

  it("rejects a submission with validation errors and does not call any API", async () => {
    const kv = new FakeKV();
    const response = await onRequestPost({
      request: makeRequest(validBody({ email: "not-an-email" })),
      env: { ...ENV_BASE, CONTACT_RATE_LIMIT: kv },
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.ok).toBe(false);
    expect(data.fields).toContain("email");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a submission with a missing or tampered reason value", async () => {
    const kv = new FakeKV();
    const response = await onRequestPost({
      request: makeRequest(validBody({ reason: "not_a_real_reason" })),
      env: { ...ENV_BASE, CONTACT_RATE_LIMIT: kv },
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.fields).toContain("reason");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a silent ok:true for a honeypot hit without calling any API", async () => {
    const kv = new FakeKV();
    const response = await onRequestPost({
      request: makeRequest(validBody({ company: "http://spam.example" })),
      env: { ...ENV_BASE, CONTACT_RATE_LIMIT: kv },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a disposable email address with 422, before calling captcha or Resend", async () => {
    const kv = new FakeKV();
    const response = await onRequestPost({
      request: makeRequest(validBody({ email: "someone@mailinator.com" })),
      env: { ...ENV_BASE, CONTACT_RATE_LIMIT: kv },
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({ ok: false, error: "disposable_email" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a message with too many URLs as spam (422)", async () => {
    const kv = new FakeKV();
    const response = await onRequestPost({
      request: makeRequest(
        validBody({ message: "Check https://a.example https://b.example https://c.example please" })
      ),
      env: { ...ENV_BASE, CONTACT_RATE_LIMIT: kv },
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({ ok: false, error: "spam" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a message containing a spam keyword (422)", async () => {
    const kv = new FakeKV();
    const response = await onRequestPost({
      request: makeRequest(validBody({ message: "Guaranteed income working from home, apply now!" })),
      env: { ...ENV_BASE, CONTACT_RATE_LIMIT: kv },
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({ ok: false, error: "spam" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a failed captcha with 422 and does not send any email", async () => {
    fetchMock = makeFetchMock({ captchaOk: false });
    vi.stubGlobal("fetch", fetchMock);

    const kv = new FakeKV();
    const response = await onRequestPost({ request: makeRequest(validBody()), env: { ...ENV_BASE, CONTACT_RATE_LIMIT: kv } });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({ ok: false, error: "captcha" });
    expect(fetchMock.mock.calls.some(([url]) => url === RESEND_URL)).toBe(false);
  });

  it("blocks the 4th submission from the same IP within an hour (limit is 3)", async () => {
    const kv = new FakeKV();
    const env = { ...ENV_BASE, CONTACT_RATE_LIMIT: kv };

    for (let i = 0; i < 3; i++) {
      const response = await onRequestPost({ request: makeRequest(validBody({ email: `ana${i}@example.com` })), env });
      expect(response.status).toBe(200);
    }

    const blocked = await onRequestPost({
      request: makeRequest(validBody({ email: "ana-fourth@example.com" })),
      env,
    });
    expect(blocked.status).toBe(429);
    await expect(blocked.json()).resolves.toEqual({ ok: false, error: "rate_limited" });
  });

  it("rate-limits independently per IP", async () => {
    const kv = new FakeKV();
    const env = { ...ENV_BASE, CONTACT_RATE_LIMIT: kv };

    for (let i = 0; i < 3; i++) {
      await onRequestPost({ request: makeRequest(validBody({ email: `ana${i}@example.com` }), "203.0.113.1"), env });
    }
    const otherIp = await onRequestPost({
      request: makeRequest(validBody({ email: "ana-other-ip@example.com" }), "198.51.100.7"),
      env,
    });
    expect(otherIp.status).toBe(200);
  });

  it("blocks a 2nd submission from the same email within a day, even from a different IP", async () => {
    const kv = new FakeKV();
    const env = { ...ENV_BASE, CONTACT_RATE_LIMIT: kv };

    const first = await onRequestPost({ request: makeRequest(validBody(), "203.0.113.1"), env });
    expect(first.status).toBe(200);

    const second = await onRequestPost({ request: makeRequest(validBody(), "198.51.100.7"), env });
    expect(second.status).toBe(429);
    await expect(second.json()).resolves.toEqual({ ok: false, error: "rate_limited" });
  });

  it("does not consume the daily email quota when the submission is rejected as spam", async () => {
    const kv = new FakeKV();
    const env = { ...ENV_BASE, CONTACT_RATE_LIMIT: kv };

    const spammy = await onRequestPost({
      request: makeRequest(validBody({ message: "Guaranteed income working from home, apply now!" })),
      env,
    });
    expect(spammy.status).toBe(422);

    const genuine = await onRequestPost({ request: makeRequest(validBody()), env });
    expect(genuine.status).toBe(200);
  });

  it("returns a 502 when the Resend API reports failure and never attempts the confirmation email", async () => {
    fetchMock = makeFetchMock({ resendOk: false });
    vi.stubGlobal("fetch", fetchMock);

    const kv = new FakeKV();
    const response = await onRequestPost({ request: makeRequest(validBody()), env: { ...ENV_BASE, CONTACT_RATE_LIMIT: kv } });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ ok: false, error: "server" });
    expect(fetchMock.mock.calls.filter(([url]) => url === RESEND_URL)).toHaveLength(1);
  });

  it("still returns ok:true when only the confirmation email fails to send", async () => {
    let resendCallCount = 0;
    fetchMock = vi.fn(async (url: string) => {
      if (url === CAPTCHA_URL) return new Response(JSON.stringify({ success: true }), { status: 200 });
      if (url === RESEND_URL) {
        resendCallCount += 1;
        // La primera llamada (notificación) tiene éxito; la segunda
        // (confirmación al remitente) falla.
        return resendCallCount === 1
          ? new Response(JSON.stringify({ id: "ok" }), { status: 200 })
          : new Response(JSON.stringify({ name: "validation_error" }), { status: 422 });
      }
      throw new Error(`Unexpected fetch to ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const kv = new FakeKV();
    const response = await onRequestPost({ request: makeRequest(validBody()), env: { ...ENV_BASE, CONTACT_RATE_LIMIT: kv } });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("returns a 502 when the fetch to the Resend API throws", async () => {
    fetchMock = vi.fn(async (url: string) => {
      if (url === CAPTCHA_URL) return new Response(JSON.stringify({ success: true }), { status: 200 });
      throw new Error("network down");
    });
    vi.stubGlobal("fetch", fetchMock);

    const kv = new FakeKV();
    const response = await onRequestPost({ request: makeRequest(validBody()), env: { ...ENV_BASE, CONTACT_RATE_LIMIT: kv } });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ ok: false, error: "server" });
  });

  it("also accepts a classic form-encoded submission (no-JS fallback)", async () => {
    const kv = new FakeKV();
    const form = new URLSearchParams({
      name: "Ana García",
      email: "ana@example.com",
      reason: "academic",
      message: "Hola, quería consultar sobre una colaboración.",
      company: "",
      consent: "on",
      lang: "es",
      "h-captcha-response": "valid-token",
    });
    const request = new Request("https://victorcazorla.com/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "CF-Connecting-IP": "203.0.113.1" },
      body: form.toString(),
    });

    const response = await onRequestPost({ request, env: { ...ENV_BASE, CONTACT_RATE_LIMIT: kv } });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
