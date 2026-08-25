/**
 * Verificación server-side de hCaptcha. A diferencia de contact.ts, este
 * archivo sí hace I/O (fetch a la API de hCaptcha), así que se mantiene
 * separado de la lógica pura de validación del formulario.
 */

export type CaptchaVerification = { success: boolean };

// hCaptcha exige application/x-www-form-urlencoded, no JSON.
// https://docs.hcaptcha.com/#verify-the-user-response-server-side
export async function verifyCaptcha(
  token: string,
  opts: { secret: string; ip?: string }
): Promise<CaptchaVerification> {
  if (!token) return { success: false };

  const body = new URLSearchParams({ secret: opts.secret, response: token });
  if (opts.ip) body.set("remoteip", opts.ip);

  try {
    const response = await fetch("https://api.hcaptcha.com/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!response.ok) return { success: false };

    const data = (await response.json()) as { success?: boolean };
    return { success: data.success === true };
  } catch {
    return { success: false };
  }
}
