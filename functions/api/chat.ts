import {
  validateMessage,
  chatRateLimitKeys,
  captchaPassKey,
  buildMessages,
  toSource,
  CHAT_MAX_PER_HOUR,
  CHAT_MAX_PER_DAY,
  CAPTCHA_PASS_TTL_SECONDS,
  type ChatSource,
} from "../_lib/chat";
import { retrieve, type KbDoc } from "../_lib/kb-search";
import { verifyCaptcha } from "../_lib/captcha";
import kbData from "../_lib/kb-content.json";

const KB = (kbData as { docs: KbDoc[] }).docs;
// Resumen curado del perfil (llms.txt): siempre va como contexto base.
const PROFILE_SUMMARY = KB.find((d) => d.id === "site/perfil-resumen");
const HOME_DOC = KB.find((d) => d.id === "site/home");

// Subconjunto mínimo de KVNamespace (mismo criterio que contact.ts).
interface KVNamespaceLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

// env.AI.run(): solo lo que se consume aquí. Los modelos antiguos
// devuelven { response }; los nuevos, formato OpenAI { choices: [...] }.
interface AiRunOptions {
  gateway?: { id: string; collectLog?: boolean };
}
interface AiResult {
  response?: string;
  choices?: Array<{ message?: { content?: string } }>;
}
interface AiBinding {
  run(model: string, input: Record<string, unknown>, options?: AiRunOptions): Promise<AiResult>;
}

interface Env {
  AI: AiBinding;
  CONTACT_RATE_LIMIT: KVNamespaceLike;
  HCAPTCHA_SECRET: string;
  // Configurables desde wrangler.jsonc; los defaults cubren el caso de que falten.
  CHAT_MODEL?: string;
  CHAT_MODEL_FALLBACK?: string;
  AI_GATEWAY_ID?: string;
}

interface RequestContext {
  request: Request;
  env: Env;
}

// Modelos de Workers AI (Cloudflare-hosted → cubiertos por la cuota
// diaria gratuita del plan Workers Free; si se agota devuelven error,
// nunca facturan). Cloudflare retira modelos antiguos con un 410, así que
// hay un fallback: si el primario falla se reintenta con el segundo antes
// de rendirse. Ambos verificados vía el AI Gateway (2026-08-30).
const DEFAULT_MODEL = "@cf/zai-org/glm-4.7-flash"; // multilingüe, optimizado para chat
const DEFAULT_MODEL_FALLBACK = "@cf/google/gemma-4-26b-a4b-it";
const DEFAULT_GATEWAY = "victorcazorla-ai";
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

// El texto sale en `response` (modelos antiguos) o en
// `choices[0].message.content` (formato OpenAI de los nuevos). Algunos
// modelos con "reasoning" anteponen su cadena de pensamiento en un bloque
// <think>…</think>: se descarta.
function cleanAnswer(result: AiResult): string {
  const raw = result.response ?? result.choices?.[0]?.message?.content ?? "";
  return String(raw)
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^\s*<\/?think>\s*/i, "")
    .trim();
}

/** perfil-resumen + top-K recuperados (deduplicado), con home como red de seguridad. */
function selectContext(message: string): KbDoc[] {
  const hits = retrieve(message, KB, 3);
  const picked: KbDoc[] = [];
  const seen = new Set<string>();
  const add = (doc?: KbDoc) => {
    if (doc && !seen.has(doc.id)) {
      seen.add(doc.id);
      picked.push(doc);
    }
  };
  add(PROFILE_SUMMARY);
  for (const hit of hits) add(hit.doc);
  if (picked.length === 1) add(HOME_DOC); // la consulta no casó con nada
  return picked;
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

  // 4. Consume una unidad de cuota justo antes de la llamada al modelo.
  await Promise.all([
    env.CONTACT_RATE_LIMIT.put(hourKey, String(hourCount + 1), { expirationTtl: 3600 }),
    env.CONTACT_RATE_LIMIT.put(dayKey, String(dayCount + 1), { expirationTtl: 86400 }),
  ]);

  // 5. Recupera contexto de la base de conocimiento empaquetada y genera
  // la respuesta con Workers AI (cuota diaria gratuita). La llamada pasa
  // por el AI Gateway, así que cada pregunta queda registrada en el panel.
  const docs = selectContext(message);
  const gatewayId = env.AI_GATEWAY_ID || DEFAULT_GATEWAY;
  const models = [env.CHAT_MODEL || DEFAULT_MODEL, env.CHAT_MODEL_FALLBACK || DEFAULT_MODEL_FALLBACK].filter(
    (m, i, arr) => m && arr.indexOf(m) === i
  );
  const input = { messages: buildMessages(message, docs), max_tokens: 512, temperature: 0.2 };

  let answer = "";
  for (const model of models) {
    try {
      const out = await env.AI.run(model, input, { gateway: { id: gatewayId, collectLog: true } });
      answer = cleanAnswer(out);
      if (answer) break;
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "chat_model_failed",
          timestamp: new Date().toISOString(),
          ip,
          model,
          message: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  if (!answer) return json({ ok: false, error: "server" }, 502);

  const sources: ChatSource[] = docs
    .filter((d) => d.id !== "site/perfil-resumen" && d.url)
    .map(toSource)
    .slice(0, 4);

  return json({ ok: true, answer, sources });
}
