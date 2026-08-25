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
    ...overrides,
  };
}

describe("onRequestPost /api/contact", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ id: "49a3999c-0ce1-4ea6-ab68-afcd6dc2e794" }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the email and returns ok:true for a valid submission", async () => {
    const kv = new FakeKV();
    const response = await onRequestPost({ request: makeRequest(validBody()), env: { ...ENV_BASE, CONTACT_RATE_LIMIT: kv } });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.Authorization).toBe("Bearer test-key");
    const body = JSON.parse(init.body);
    expect(body.from).toBe("Formulario de contacto <web@victorcazorla.com>");
    expect(body.reply_to).toBe("Ana García <ana@example.com>");
  });

  it("rejects a submission with validation errors and does not call the API", async () => {
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

  it("returns a silent ok:true for a honeypot hit without calling the API", async () => {
    const kv = new FakeKV();
    const response = await onRequestPost({
      request: makeRequest(validBody({ company: "http://spam.example" })),
      env: { ...ENV_BASE, CONTACT_RATE_LIMIT: kv },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("blocks the 6th submission from the same IP within an hour", async () => {
    const kv = new FakeKV();
    const env = { ...ENV_BASE, CONTACT_RATE_LIMIT: kv };

    for (let i = 0; i < 5; i++) {
      const response = await onRequestPost({ request: makeRequest(validBody()), env });
      expect(response.status).toBe(200);
    }

    const blocked = await onRequestPost({ request: makeRequest(validBody()), env });
    expect(blocked.status).toBe(429);
    await expect(blocked.json()).resolves.toEqual({ ok: false, error: "rate_limited" });
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("rate-limits independently per IP", async () => {
    const kv = new FakeKV();
    const env = { ...ENV_BASE, CONTACT_RATE_LIMIT: kv };

    for (let i = 0; i < 5; i++) {
      await onRequestPost({ request: makeRequest(validBody(), "203.0.113.1"), env });
    }
    const otherIp = await onRequestPost({ request: makeRequest(validBody(), "198.51.100.7"), env });
    expect(otherIp.status).toBe(200);
  });

  it("returns a 502 when the Resend API reports failure", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ name: "validation_error", message: "Invalid `from` field" }), {
        status: 422,
      })
    );
    const kv = new FakeKV();
    const response = await onRequestPost({ request: makeRequest(validBody()), env: { ...ENV_BASE, CONTACT_RATE_LIMIT: kv } });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ ok: false, error: "server" });
  });

  it("returns a 502 when the fetch to the Resend API throws", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));
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
