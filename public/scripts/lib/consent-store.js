/**
 * Almacén del consentimiento de cookies analíticas.
 *
 * Se guarda en localStorage bajo la clave `cookie-consent`, con la forma
 * { accepted: boolean, timestamp: number, version: number }.
 *
 * - `parseConsent` / `serializeConsent` son lógica pura (sin acceso a
 *   localStorage ni al reloj real) para poder testearlas con Vitest,
 *   igual que functions/_lib/contact.ts.
 * - `readConsent` / `writeConsent` son los envoltorios de E/S: envuelven
 *   todo en try/catch porque en modo incógnito o con el almacenamiento
 *   bloqueado el acceso puede lanzar.
 */

export const CONSENT_KEY = "cookie-consent";

// Súbelo cuando cambie de forma material la política de cookies: el
// aviso volverá a mostrarse a todo el mundo aunque ya hubieran decidido.
export const CONSENT_VERSION = 1;

// El consentimiento (aceptado o rechazado) se recuerda 365 días; pasado
// ese plazo se vuelve a preguntar.
export const CONSENT_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Devuelve el consentimiento almacenado si es válido (versión actual,
 * dentro de plazo y con forma correcta); si no, `null`.
 */
export function parseConsent(raw, now = Date.now()) {
  if (typeof raw !== "string" || raw === "") return null;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;
  if (typeof parsed.accepted !== "boolean") return null;
  if (typeof parsed.timestamp !== "number" || !Number.isFinite(parsed.timestamp)) return null;
  if (parsed.version !== CONSENT_VERSION) return null;
  if (now - parsed.timestamp > CONSENT_MAX_AGE_MS) return null;
  // Un timestamp en el futuro (reloj mal ajustado, manipulación) también
  // se descarta.
  if (parsed.timestamp > now) return null;

  return { accepted: parsed.accepted, timestamp: parsed.timestamp, version: parsed.version };
}

export function serializeConsent(accepted, now = Date.now()) {
  return JSON.stringify({ accepted: accepted === true, timestamp: now, version: CONSENT_VERSION });
}

export function readConsent() {
  try {
    return parseConsent(window.localStorage.getItem(CONSENT_KEY));
  } catch {
    return null;
  }
}

export function writeConsent(accepted) {
  try {
    window.localStorage.setItem(CONSENT_KEY, serializeConsent(accepted));
    return true;
  } catch {
    return false;
  }
}
