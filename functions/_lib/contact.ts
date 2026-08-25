/**
 * Lógica pura del formulario de contacto: validación, saneado y
 * construcción del payload para la API de Resend. Sin dependencias de
 * KV/fetch para poder testear con Vitest sin simular el runtime de
 * Pages Functions. (La verificación de hCaptcha sí hace fetch y vive
 * aparte, en captcha.ts.)
 */
import disposableDomains from "disposable-email-domains";

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

// Paquete "is-temp-mail" pedido originalmente no existe en npm; este es
// su sustituto de facto en el ecosistema JS: una lista estática (sin
// llamadas de red) de dominios de correo desechable, MIT, mantenida en
// https://github.com/ivolo/disposable-email-domains.
const DISPOSABLE_DOMAINS = new Set(disposableDomains.map((domain) => domain.toLowerCase()));

// Solo se llama tras pasar EMAIL_RE, así que siempre hay un "@".
export function isDisposableEmail(email: string): boolean {
  const domain = email.toLowerCase().split("@")[1] ?? "";
  return DISPOSABLE_DOMAINS.has(domain);
}

// Heurística deliberadamente conservadora: prioriza pocos falsos
// positivos (una consulta profesional legítima no debería rebotar)
// sobre cazar todo el spam posible.
export const MAX_MESSAGE_URLS = 2;

const URL_RE = /\bhttps?:\/\/\S+|\bwww\.\S+/gi;

export function countMessageUrls(message: string): number {
  return (message.match(URL_RE) ?? []).length;
}

const SPAM_KEYWORDS = [
  "viagra",
  "cialis",
  "casino",
  "lottery",
  "you have won",
  "wire transfer",
  "nigerian prince",
  "risk free",
  "make money fast",
  "guaranteed income",
  "work from home",
  "crypto giveaway",
  "bitcoin investment",
  "forex signals",
  "seo services",
  "backlink",
  "weight loss pills",
];

export function findSpamKeyword(message: string): string | null {
  const lower = message.toLowerCase();
  return SPAM_KEYWORDS.find((keyword) => lower.includes(keyword)) ?? null;
}

export type SpamCheck = { isSpam: false } | { isSpam: true; reason: "too_many_urls" | "spam_keyword" };

export function checkForSpamContent(message: string): SpamCheck {
  if (countMessageUrls(message) > MAX_MESSAGE_URLS) return { isSpam: true, reason: "too_many_urls" };
  if (findSpamKeyword(message)) return { isSpam: true, reason: "spam_keyword" };
  return { isSpam: false };
}

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

// Mismo esquema de ventana fija que rateLimitKey, pero por email y a
// un día vista: limita cuántas veces puede escribir la misma persona,
// independientemente de desde cuántas IPs lo intente.
export function emailRateLimitKey(email: string, now: number = Date.now()): string {
  const dayBucket = Math.floor(now / (24 * 60 * 60 * 1000));
  return `rl-email:${email.toLowerCase()}:${dayBucket}`;
}

export type ConfirmationEmailCopy = { subject: string; body: string };

// Solo se usa en el servidor (nunca se renderiza en las páginas de
// Astro), así que no hace falta duplicarlo en src/data/i18n.ts como
// contactReasons: aquí es la única fuente.
const CONFIRMATION_COPY: Record<"es" | "en" | "fr" | "ca", ConfirmationEmailCopy> = {
  es: {
    subject: "Confirmación de recepción - Víctor Cazorla",
    body: "Hemos recibido tu mensaje. Te responderé en la mayor brevedad posible.",
  },
  en: {
    subject: "Message received - Víctor Cazorla",
    body: "We have received your message. I will get back to you as soon as possible.",
  },
  fr: {
    subject: "Message bien reçu - Víctor Cazorla",
    body: "Nous avons bien reçu votre message. Je vous répondrai dans les meilleurs délais.",
  },
  ca: {
    subject: "Confirmació de recepció - Víctor Cazorla",
    body: "Hem rebut el teu missatge. Et respondré tan aviat com pugui.",
  },
};

export function getConfirmationCopy(lang: unknown): ConfirmationEmailCopy {
  return CONFIRMATION_COPY[lang as keyof typeof CONFIRMATION_COPY] ?? CONFIRMATION_COPY.es;
}

export function buildConfirmationEmailPayload(
  data: ContactData,
  opts: { fromAddress: string; fromName?: string; lang: unknown }
): EmailPayload {
  const copy = getConfirmationCopy(opts.lang);

  return {
    to: sanitizeAddressPart(data.email),
    from: formatAddress(opts.fromAddress, opts.fromName ?? "Víctor Cazorla Fernández"),
    reply_to: opts.fromAddress,
    subject: copy.subject,
    text: copy.body,
    html: `<p>${escapeHtml(copy.body)}</p>`,
  };
}
