import {
  validateContactSubmission,
  buildEmailPayload,
  buildConfirmationEmailPayload,
  rateLimitKey,
  emailRateLimitKey,
  isDisposableEmail,
  checkForSpamContent,
  type ContactInput,
  type EmailPayload,
} from "../_lib/contact";
import { verifyCaptcha } from "../_lib/captcha";

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
  HCAPTCHA_SECRET: string;
}

interface RequestContext {
  request: Request;
  env: Env;
}

const IP_RATE_LIMIT_MAX_PER_HOUR = 3;
const EMAIL_RATE_LIMIT_MAX_PER_DAY = 1;
const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

// Log estructurado de intentos bloqueados, para auditoría y detección
// de patrones (Cloudflare Workers Logs / `wrangler pages deployment
// tail`). Solo se llama para intentos con indicios reales de abuso, no
// para errores de validación ordinarios (un typo en el email no es un
// "intento bloqueado").
type BlockReason =
  | "ip_rate_limited"
  | "email_rate_limited"
  | "disposable_email"
  | "spam_too_many_urls"
  | "spam_keyword"
  | "captcha_failed"
  | "honeypot";

function logBlockedAttempt(reason: BlockReason, details: { ip: string; email?: string }): void {
  console.warn(
    JSON.stringify({
      event: "contact_form_blocked",
      timestamp: new Date().toISOString(),
      reason,
      ip: details.ip,
      email: details.email ?? null,
    })
  );
}

async function sendEmail(payload: EmailPayload, apiKey: string): Promise<boolean> {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    return response.ok;
  } catch {
    return false;
  }
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

  // 1. Límite por IP: la comprobación más barata, primera línea de
  // defensa contra abuso puramente volumétrico.
  const ipRateLimitKey = rateLimitKey(ip);
  const ipCount = Number((await env.CONTACT_RATE_LIMIT.get(ipRateLimitKey)) ?? "0");
  if (ipCount >= IP_RATE_LIMIT_MAX_PER_HOUR) {
    logBlockedAttempt("ip_rate_limited", { ip });
    return json({ ok: false, error: "rate_limited" }, 429);
  }
  await env.CONTACT_RATE_LIMIT.put(ipRateLimitKey, String(ipCount + 1), { expirationTtl: 3600 });

  let body: Record<string, unknown>;
  try {
    body = await parseBody(request);
  } catch {
    return json({ ok: false, error: "validation", fields: [] }, 400);
  }

  const input: ContactInput = {
    name: body.name,
    email: body.email,
    reason: body.reason,
    message: body.message,
    honeypot: body.company,
    consent: body.consent,
    ts: body.ts,
  };

  // 2. Validación básica de campos (formato, longitud, honeypot,
  // timing): sigue siendo barata y no depende de I/O.
  const result = validateContactSubmission(input);
  if (!result.valid) {
    // Un bot que solo rellena el señuelo recibe un "éxito" falso, para
    // que no aprenda a evitar el campo; cualquier otro fallo se informa
    // con normalidad.
    if (result.errors.length === 1 && result.errors[0] === "honeypot") {
      logBlockedAttempt("honeypot", { ip });
      return json({ ok: true });
    }
    return json({ ok: false, error: "validation", fields: result.errors }, 400);
  }

  const { data } = result;

  // 3. Límite por email: 1 mensaje/día, independientemente de la IP.
  const emailKey = emailRateLimitKey(data.email);
  const emailCount = Number((await env.CONTACT_RATE_LIMIT.get(emailKey)) ?? "0");
  if (emailCount >= EMAIL_RATE_LIMIT_MAX_PER_DAY) {
    logBlockedAttempt("email_rate_limited", { ip, email: data.email });
    return json({ ok: false, error: "rate_limited" }, 429);
  }

  // 4. Email desechable: lookup en memoria, sin red.
  if (isDisposableEmail(data.email)) {
    logBlockedAttempt("disposable_email", { ip, email: data.email });
    return json({ ok: false, error: "disposable_email" }, 422);
  }

  // 5. Contenido tipo spam: regex sobre el mensaje, sin red.
  const spamCheck = checkForSpamContent(data.message);
  if (spamCheck.isSpam) {
    logBlockedAttempt(spamCheck.reason === "too_many_urls" ? "spam_too_many_urls" : "spam_keyword", {
      ip,
      email: data.email,
    });
    return json({ ok: false, error: "spam" }, 422);
  }

  // 6. CAPTCHA: la única comprobación que hace una llamada de red a un
  // tercero, así que va la última — solo se gasta esa llamada (y la
  // cuota de hCaptcha) en envíos que ya han pasado todo lo demás.
  const captchaToken = typeof body["h-captcha-response"] === "string" ? body["h-captcha-response"] : "";
  const captcha = await verifyCaptcha(captchaToken, { secret: env.HCAPTCHA_SECRET, ip });
  if (!captcha.success) {
    logBlockedAttempt("captcha_failed", { ip, email: data.email });
    return json({ ok: false, error: "captcha" }, 422);
  }

  // Reserva la cuota de email solo cuando el envío va a intentarse de
  // verdad, para no penalizar a alguien cuyo primer intento se rechazó
  // por spam/captcha antes de llegar aquí.
  await env.CONTACT_RATE_LIMIT.put(emailKey, String(emailCount + 1), { expirationTtl: 86400 });

  const payload = buildEmailPayload(data, {
    toAddress: env.CONTACT_TO_EMAIL,
    fromAddress: env.CONTACT_FROM_EMAIL,
  });

  const sent = await sendEmail(payload, env.RESEND_API_KEY);
  if (!sent) {
    return json({ ok: false, error: "server" }, 502);
  }

  // Best-effort: si la confirmación al remitente falla, el mensaje
  // principal ya ha llegado, así que la respuesta sigue siendo un
  // éxito para quien ha escrito el formulario.
  const confirmationPayload = buildConfirmationEmailPayload(data, {
    fromAddress: env.CONTACT_FROM_EMAIL,
    lang: body.lang,
  });
  const confirmationSent = await sendEmail(confirmationPayload, env.RESEND_API_KEY);
  if (!confirmationSent) {
    console.warn(JSON.stringify({ event: "contact_confirmation_failed", timestamp: new Date().toISOString(), ip }));
  }

  return json({ ok: true });
}
