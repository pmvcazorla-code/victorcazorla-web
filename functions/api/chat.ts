import {
  validateMessage,
  chatRateLimitKeys,
  captchaPassKey,
  extractSources,
  CHAT_MAX_PER_HOUR,
  CHAT_MAX_PER_DAY,
  CAPTCHA_PASS_TTL_SECONDS,
  type ChatSource,
} from "../_lib/chat";
import { verifyCaptcha } from "../_lib/captcha";

// Subconjunto mínimo de KVNamespace (mismo criterio que contact.ts: no
// añadir @cloudflare/workers-types solo para tipar tres métodos).
interface KVNamespaceLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

// La respuesta de env.AI.autorag(...).aiSearch(): solo lo que se consume aquí.
interface AiSearchResult {
  response?: string;
  data?: unknown;
}
interface AiBinding {
  autorag(instance: string): { aiSearch(opts: Record<string, unknown>): Promise<AiSearchResult> };
}

interface Env {
  AI: AiBinding;
  CONTACT_RATE_LIMIT: KVNamespaceLike;
  HCAPTCHA_SECRET: string;
  // Nombre de la instancia de AI Search (Panel → AI → AI Search). Se
  // configura como var en wrangler.jsonc; este default cubre el caso de
  // que falte.
  AI_SEARCH_INSTANCE?: string;
}

interface RequestContext {
  request: Request;
  env: Env;
}

const DEFAULT_INSTANCE = "victorcazorla-ai-search";
const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

type BlockReason = "ip_rate_limited" | "captcha_required" | "captcha_failed" | "message_invalid";

function logBlocked(reason: BlockReason, ip: string, extra: Record<string, unknown> = {}): void {
  console.warn(
    JSON.stringify({ event: "chat_blocked", timestamp: new Date().toISOString(), reason, ip, ...extra })
  );
}

async function readCount(kv: KVNamespaceLike, key: string): Promise<number> {
  return Number((await kv.get(key)) ?? "0");
}

export async function onRequestPost(context: RequestContext): Promise<Response> {
  const { request, env } = context;
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";

  // 1. Rate-limit por IP (hora + día): la comprobación más barata.
  const { hourKey, dayKey } = chatRateLimitKeys(ip);
  const [hourCount, dayCount] = await Promise.all([
    readCount(env.CONTACT_RATE_LIMIT, hourKey),
    readCount(env.CONTACT_RATE_LIMIT, dayKey),
  ]);
  if (hourCount >= CHAT_MAX_PER_HOUR || dayCount >= CHAT_MAX_PER_DAY) {
    logBlocked("ip_rate_limited", ip, { hourCount, dayCount });
    return json({ ok: false, error: "rate_limited" }, 429);
  }

  // 2. Cuerpo y validación del mensaje (sin red).
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "bad_request" }, 400);
  }

  const check = validateMessage(body.message);
  if (!check.valid) {
    logBlocked("message_invalid", ip, { reason: check.error });
    return json({ ok: false, error: check.error === "too_long" ? "too_long" : "empty" }, 400);
  }
  const message = check.value;

  // 3. hCaptcha: solo la primera vez por IP. Tras resolverlo se guarda un
  // "pase" en KV (TTL 2 h) y los siguientes mensajes no lo piden.
  const passKey = captchaPassKey(ip);
  const alreadyVerified = (await env.CONTACT_RATE_LIMIT.get(passKey)) !== null;
  if (!alreadyVerified) {
    const token = typeof body.token === "string" ? body.token : "";
    if (!token) {
      logBlocked("captcha_required", ip);
      return json({ ok: false, error: "captcha_required" }, 401);
    }
    const captcha = await verifyCaptcha(token, { secret: env.HCAPTCHA_SECRET, ip });
    if (!captcha.success) {
      logBlocked("captcha_failed", ip, { hasSecret: Boolean(env.HCAPTCHA_SECRET) });
      return json({ ok: false, error: "captcha" }, 422);
    }
    await env.CONTACT_RATE_LIMIT.put(passKey, "1", { expirationTtl: CAPTCHA_PASS_TTL_SECONDS });
  }

  // 4. Consume una unidad de cuota justo antes de la llamada cara.
  await Promise.all([
    env.CONTACT_RATE_LIMIT.put(hourKey, String(hourCount + 1), { expirationTtl: 3600 }),
    env.CONTACT_RATE_LIMIT.put(dayKey, String(dayCount + 1), { expirationTtl: 86400 }),
  ]);

  // 5. RAG contra AI Search. El system prompt y los guardarraíles se
  // configuran a nivel de instancia en el panel (scripts/kb/system-prompt.md);
  // aquí solo se pasa la consulta. Las peticiones quedan registradas en el
  // AI Gateway enlazado a la instancia.
  const instance = env.AI_SEARCH_INSTANCE || DEFAULT_INSTANCE;
  let result: AiSearchResult;
  try {
    result = await env.AI.autorag(instance).aiSearch({ query: message, rewrite_query: true });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "chat_ai_search_failed",
        timestamp: new Date().toISOString(),
        ip,
        instance,
        message: error instanceof Error ? error.message : String(error),
      })
    );
    return json({ ok: false, error: "server" }, 502);
  }

  const answer = (result.response || "").trim();
  if (!answer) return json({ ok: false, error: "server" }, 502);

  const sources: ChatSource[] = extractSources(result.data);
  return json({ ok: true, answer, sources });
}
