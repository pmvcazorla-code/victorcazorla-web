/**
 * Clasificación del host actual, compartida por gtag-init.js y
 * cookie-consent.js para que apliquen el mismo criterio.
 */

/** localhost / 127.0.0.1 / [::1]: desarrollo local. */
export function isLocalHost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

/**
 * ¿Es el sitio en producción real (victorcazorla.com y alias)?
 * Excluye el desarrollo local y los dominios *.pages.dev (alias de
 * producción y previews de rama de Cloudflare Pages). Solo aquí se
 * carga Google Analytics.
 *
 * El aviso de cookies, en cambio, SÍ se muestra en las previews
 * (para poder revisarlo), solo se oculta en local — ver
 * cookie-consent.js.
 */
export function isProductionHost(hostname) {
  return !isLocalHost(hostname) && !hostname.endsWith(".pages.dev");
}
