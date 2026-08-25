import { validateContactSubmission, buildEmailPayload, rateLimitKey, type ContactInput } from "../_lib/contact";

// Subconjunto mínimo de KVNamespace: evita añadir @cloudflare/workers-types
// como dependencia solo para tipar dos métodos.
interface KVNamespaceLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

interface Env {
  CONTACT_RATE_LIMIT: KVNamespaceLike;
  RESEND_API_KEY: string;
  CONTACT_TO_EMAIL: string;
  CONTACT_FROM_EMAIL: string;
}

interface RequestContext {
  request: Request;
  env: Env;
}

const RATE_LIMIT_MAX_PER_HOUR = 5;
const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

async function parseBody(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return await request.json();
  }

  // Fallback para el <form method="post"> nativo cuando el JS del
  // cliente no ha podido interceptar el submit.
  const form = await request.formData();
  const result: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") result[key] = value;
  }
  if (typeof result.consent === "string") {
    result.consent = result.consent === "on" || result.consent === "true";
  }
  if (typeof result.ts === "string" && result.ts !== "") {
    result.ts = Number(result.ts);
  }
  return result;
}

export async function onRequestPost(context: RequestContext): Promise<Response> {
  const { request, env } = context;

  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const rateLimitBucketKey = rateLimitKey(ip);
  const currentCount = Number((await env.CONTACT_RATE_LIMIT.get(rateLimitBucketKey)) ?? "0");

  if (currentCount >= RATE_LIMIT_MAX_PER_HOUR) {
    return json({ ok: false, error: "rate_limited" }, 429);
  }

  await env.CONTACT_RATE_LIMIT.put(rateLimitBucketKey, String(currentCount + 1), { expirationTtl: 3600 });

  let body: Record<string, unknown>;
  try {
    body = await parseBody(request);
  } catch {
    return json({ ok: false, error: "validation", fields: [] }, 400);
  }

  const input: ContactInput = {
    name: body.name,
    email: body.email,
    message: body.message,
    honeypot: body.company,
    consent: body.consent,
    ts: body.ts,
  };

  const result = validateContactSubmission(input);
  if (!result.valid) {
    // Un bot que solo rellena el señuelo recibe un "éxito" falso, para
    // que no aprenda a evitar el campo; cualquier otro fallo se informa
    // con normalidad.
    if (result.errors.length === 1 && result.errors[0] === "honeypot") {
      return json({ ok: true });
    }
    return json({ ok: false, error: "validation", fields: result.errors }, 400);
  }

  const payload = buildEmailPayload(result.data, {
    toAddress: env.CONTACT_TO_EMAIL,
    fromAddress: env.CONTACT_FROM_EMAIL,
  });

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return json({ ok: false, error: "server" }, 502);
    }
  } catch {
    return json({ ok: false, error: "server" }, 502);
  }

  return json({ ok: true });
}
