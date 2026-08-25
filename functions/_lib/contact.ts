/**
 * Lógica pura del formulario de contacto: validación, saneado y
 * construcción del payload para la API de Resend. Sin dependencias de
 * KV/fetch para poder testear con Vitest sin simular el runtime de
 * Pages Functions.
 */

export const NAME_MAX_LENGTH = 120;
export const MESSAGE_MIN_LENGTH = 10;
export const MESSAGE_MAX_LENGTH = 5000;
// Ningún visitante humano rellena y envía el formulario en menos de esto;
// filtra los bots que hacen POST directo sin ejecutar el JS de la página.
export const MIN_SUBMIT_MS = 2000;
// Un ts más viejo que esto es una pestaña abierta desde hace horas o un
// intento de repetir una petición capturada, no un envío normal.
export const MAX_SUBMIT_AGE_MS = 60 * 60 * 1000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Mismos valores (no las etiquetas) que contactReasons en src/data/i18n.ts,
// que construye el <select> del formulario. Este archivo no importa nada
// de src/ (Pages Functions se empaqueta aparte de la build de Astro), así
// que la lista se mantiene duplicada a propósito: si se añade/renombra
// una razón, hay que tocar los dos sitios.
export const CONTACT_REASON_VALUES = [
  "it_opportunities",
  "science_research",
  "philosophy_research",
  "professional_ethics",
  "academic",
  "other",
] as const;

export type ContactReason = (typeof CONTACT_REASON_VALUES)[number];

const REASON_LABELS_ES: Record<ContactReason, string> = {
  it_opportunities: "Oportunidades IT",
  science_research: "Investigación Ciencia",
  philosophy_research: "Investigación Filosofía",
  professional_ethics: "Ética profesional",
  academic: "Académico",
  other: "Otros",
};

function isContactReason(value: string): value is ContactReason {
  return (CONTACT_REASON_VALUES as readonly string[]).includes(value);
}

export type ContactInput = {
  name: unknown;
  email: unknown;
  reason: unknown;
  message: unknown;
  honeypot: unknown;
  consent: unknown;
  ts: unknown;
};

export type ContactData = {
  name: string;
  email: string;
  reason: ContactReason;
  message: string;
};

export type ContactFieldError = "honeypot" | "name" | "email" | "reason" | "message" | "consent" | "timing";

export type ValidationResult =
  | { valid: true; data: ContactData }
  | { valid: false; errors: ContactFieldError[] };

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function validateContactSubmission(input: ContactInput, now: number = Date.now()): ValidationResult {
  const errors: ContactFieldError[] = [];

  // Campo señuelo: cualquier valor no vacío delata un envío automatizado.
  if (asString(input.honeypot) !== "") {
    errors.push("honeypot");
  }

  const name = asString(input.name);
  if (!name || name.length > NAME_MAX_LENGTH) errors.push("name");

  const email = asString(input.email);
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) errors.push("email");

  const reason = asString(input.reason);
  if (!isContactReason(reason)) errors.push("reason");

  const message = asString(input.message);
  if (message.length < MESSAGE_MIN_LENGTH || message.length > MESSAGE_MAX_LENGTH) errors.push("message");

  if (input.consent !== true) errors.push("consent");

  const ts = typeof input.ts === "number" ? input.ts : null;
  if (ts !== null) {
    const elapsed = now - ts;
    if (elapsed < MIN_SUBMIT_MS || elapsed > MAX_SUBMIT_AGE_MS) errors.push("timing");
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, data: { name, email, reason: reason as ContactReason, message } };
}

// Evita la inyección de cabeceras de correo (un salto de línea en
// "nombre" podría añadir un Bcc: o un Subject: falso al mensaje).
export function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type EmailPayload = {
  to: string;
  from: string;
  reply_to: string;
  subject: string;
  text: string;
  html: string;
};

// El formato "Nombre <email>" de Resend concatena ambas partes en un
// único string estructurado: un "<" o ">" o "," dentro del nombre (o de
// un email que la regex de validación no descarta) podría cerrar la
// dirección antes de tiempo o colar una segunda dirección.
function sanitizeAddressPart(value: string): string {
  return value.replace(/[<>,"]/g, "").trim();
}

function formatAddress(address: string, name?: string): string {
  const safeAddress = sanitizeAddressPart(address);
  const safeName = name ? sanitizeAddressPart(name) : "";
  return safeName ? `${safeName} <${safeAddress}>` : safeAddress;
}

export function buildEmailPayload(
  data: ContactData,
  opts: { toAddress: string; fromAddress: string; fromName?: string }
): EmailPayload {
  const safeName = sanitizeHeaderValue(data.name).slice(0, 200);
  const safeEmail = sanitizeHeaderValue(data.email);
  const reasonLabel = REASON_LABELS_ES[data.reason];
  const subject = sanitizeHeaderValue(`Nuevo mensaje de contacto (${reasonLabel}) de ${safeName}`).slice(0, 200);

  const text = `Nombre: ${safeName}\nEmail: ${safeEmail}\nRazón: ${reasonLabel}\n\nMensaje:\n${data.message}`;
  const html = [
    `<p><strong>Nombre:</strong> ${escapeHtml(safeName)}</p>`,
    `<p><strong>Email:</strong> ${escapeHtml(safeEmail)}</p>`,
    `<p><strong>Razón:</strong> ${escapeHtml(reasonLabel)}</p>`,
    `<p><strong>Mensaje:</strong></p>`,
    `<p>${escapeHtml(data.message).replace(/\n/g, "<br>")}</p>`,
  ].join("");

  return {
    to: opts.toAddress,
    from: formatAddress(opts.fromAddress, opts.fromName ?? "Formulario de contacto"),
    reply_to: formatAddress(safeEmail, safeName),
    subject,
    text,
    html,
  };
}

// Ventana fija por IP+hora: no es perfectamente atómico bajo
// concurrencia alta (get+put no es una operación única en KV), pero de
// sobra para el volumen de tráfico de un formulario de contacto
// personal.
export function rateLimitKey(ip: string, now: number = Date.now(), windowMinutes = 60): string {
  const bucket = Math.floor(now / (windowMinutes * 60 * 1000));
  return `rl:${ip}:${bucket}`;
}
