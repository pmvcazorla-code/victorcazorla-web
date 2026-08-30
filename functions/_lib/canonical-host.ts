/**
 * Decide qué hacer con una petición según su nombre de host, para que
 * solo victorcazorla.com sea la versión "oficial" del sitio:
 *
 * - victorcazorla-web.pages.dev (alias de producción de Cloudflare
 *   Pages): redirige 301 al dominio real. Evita el contenido duplicado
 *   y concentra la autoridad SEO en un único dominio.
 * - <hash>.victorcazorla-web.pages.dev (previews de rama): se dejan
 *   funcionando para poder revisarlas, pero con X-Robots-Tag para que
 *   los buscadores no las indexen.
 * - cualquier otro host (el dominio real y sus alias con redirección
 *   propia): pasa sin tocar.
 *
 * Lógica pura, sin dependencias del runtime de Pages, para poder
 * testearla con Vitest (mismo criterio que functions/_lib/contact.ts).
 */

const CANONICAL_ORIGIN = "https://victorcazorla.com";
const PRODUCTION_PAGES_HOST = "victorcazorla-web.pages.dev";

export type HostAction =
  | { type: "pass" }
  | { type: "redirect"; location: string }
  | { type: "noindex" };

export function resolveHostAction(hostname: string, pathAndQuery: string): HostAction {
  if (hostname === PRODUCTION_PAGES_HOST) {
    return { type: "redirect", location: `${CANONICAL_ORIGIN}${pathAndQuery}` };
  }
  if (hostname.endsWith(".pages.dev")) {
    return { type: "noindex" };
  }
  return { type: "pass" };
}
