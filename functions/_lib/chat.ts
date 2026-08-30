/**
 * Lógica pura del chatbot de /inicio: validación del mensaje, claves de
 * rate-limit en KV y reconstrucción de las URLs de origen a partir de las
 * claves del bucket de AI Search. Sin dependencias de KV/fetch para poder
 * testear con Vitest sin simular el runtime de Pages Functions (la
 * verificación de hCaptcha vive en captcha.ts, igual que en el formulario
 * de contacto).
 */

export const MESSAGE_MIN_LENGTH = 2;
export const MESSAGE_MAX_LENGTH = 500;

// Ventana por IP: suficiente para una conversación real, corta el abuso
// volumétrico (y el gasto en Workers AI) de un bucle automatizado.
export const CHAT_MAX_PER_HOUR = 15;
export const CHAT_MAX_PER_DAY = 50;

// TTL del "pase" que se guarda en KV tras resolver el hCaptcha una vez,
// para no pedirlo en cada mensaje de la misma sesión/IP.
export const CAPTCHA_PASS_TTL_SECONDS = 2 * 60 * 60;

const SITE = "https://victorcazorla.com";

export type MessageValidation =
  | { valid: true; value: string }
  | { valid: false; error: "empty" | "too_long" };

export function validateMessage(raw: unknown): MessageValidation {
  const value = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
  if (value.length < MESSAGE_MIN_LENGTH) return { valid: false, error: "empty" };
  if (value.length > MESSAGE_MAX_LENGTH) return { valid: false, error: "too_long" };
  return { valid: true, value };
}

// Ventana fija por IP+hora e IP+día, mismo esquema que rateLimitKey del
// formulario de contacto. get+put en KV no es atómico, pero de sobra para
// el tráfico de un sitio personal.
export function chatRateLimitKeys(ip: string, now: number = Date.now()): { hourKey: string; dayKey: string } {
  const hour = Math.floor(now / (60 * 60 * 1000));
  const day = Math.floor(now / (24 * 60 * 60 * 1000));
  return { hourKey: `chat:rl:h:${ip}:${hour}`, dayKey: `chat:rl:d:${ip}:${day}` };
}

export function captchaPassKey(ip: string): string {
  return `chat:captcha-ok:${ip}`;
}

/**
 * Clave del bucket de AI Search -> URL pública de la página.
 *   site/home.md              -> https://victorcazorla.com/
 *   site/en/ethics.md         -> https://victorcazorla.com/en/ethics/
 *   site/perfil-resumen.md    -> https://victorcazorla.com/
 *   curated/lo-que-sea.md     -> null  (material sin URL canónica)
 */
export function siteUrlForKey(key: string): string | null {
  if (!key.startsWith("site/")) return null;
  const slug = key.slice("site/".length).replace(/\.md$/, "");
  if (slug === "home" || slug === "perfil-resumen") return `${SITE}/`;
  return `${SITE}/${slug}/`;
}

function titleForKey(key: string): string {
  const slug = key.replace(/^(site|curated)\//, "").replace(/\.md$/, "");
  const last = slug.split("/").pop() || slug;
  return last
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export type ChatSource = { title: string; url: string | null };

type RetrievedDoc = {
  filename?: string;
  file_id?: string;
  attributes?: Record<string, unknown> | null;
};

/**
 * Extrae hasta `limit` fuentes únicas de la respuesta de aiSearch, en
 * orden de aparición (que ya viene ordenado por relevancia).
 */
export function extractSources(data: unknown, limit = 4): ChatSource[] {
  if (!Array.isArray(data)) return [];
  const seen = new Set<string>();
  const out: ChatSource[] = [];
  for (const doc of data as RetrievedDoc[]) {
    const key = typeof doc?.filename === "string" ? doc.filename : "";
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const attrTitle =
      doc.attributes && typeof doc.attributes.title === "string" ? (doc.attributes.title as string) : "";
    out.push({ title: attrTitle || titleForKey(key), url: siteUrlForKey(key) });
    if (out.length >= limit) break;
  }
  return out;
}
