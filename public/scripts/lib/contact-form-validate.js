/**
 * Validación de cliente para el formulario de contacto. Duplica (en
 * versión mínima) las reglas del servidor en functions/_lib/contact.ts,
 * solo para dar feedback instantáneo antes del fetch; el servidor sigue
 * siendo la fuente de verdad. Sin dependencias del DOM para poder
 * importarse tanto desde el navegador como desde los tests de Vitest.
 */
export const MESSAGE_MIN_LENGTH = 10;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateContactFields({ name, email, message, consent }) {
  const errors = [];

  if (!name || !name.trim()) errors.push("name");
  if (!email || !EMAIL_RE.test(email.trim())) errors.push("email");
  if (!message || message.trim().length < MESSAGE_MIN_LENGTH) errors.push("message");
  if (!consent) errors.push("consent");

  return errors;
}
