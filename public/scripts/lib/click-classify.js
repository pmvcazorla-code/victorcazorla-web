/**
 * Lógica pura de clasificación de clics para el tracking de GA4.
 * Sin dependencias del DOM (aparte de recibir la URL base ya resuelta)
 * para poder importarse tanto desde el navegador como desde los tests
 * de Vitest.
 */
export const DOWNLOAD_EXTENSIONS = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "zip"];

export const PROFESSIONAL_DOMAINS = [
  "linkedin.com",
  "orcid.org",
  "credly.com",
  "researchgate.net",
  "scholar.google",
  "doi.org",
  "arxiv.org",
];

export function fileExtension(pathname) {
  const match = pathname.match(/\.([a-z0-9]+)$/i);
  return match ? match[1].toLowerCase() : "";
}

export function fileName(pathname) {
  return pathname.substring(pathname.lastIndexOf("/") + 1) || pathname;
}

/**
 * @param {string} href - valor bruto del atributo href del enlace clicado
 * @param {string} hostname - hostname de la página actual (para distinguir enlaces internos/externos)
 * @param {string} baseHref - URL base para resolver hrefs relativos (window.location.href en el navegador)
 */
export function classify(href, hostname, baseHref) {
  if (href.indexOf("mailto:") === 0) {
    return { type: "contact" };
  }

  let url;
  try {
    url = new URL(href, baseHref);
  } catch (e) {
    return null;
  }

  const ext = fileExtension(url.pathname);
  if (DOWNLOAD_EXTENSIONS.indexOf(ext) !== -1) {
    return { type: "download", ext };
  }

  if (url.hostname && url.hostname !== hostname) {
    const isProfessional = PROFESSIONAL_DOMAINS.some((domain) => url.hostname.indexOf(domain) !== -1);
    return { type: "outbound", hostname: url.hostname, professional: isProfessional };
  }

  return null;
}
