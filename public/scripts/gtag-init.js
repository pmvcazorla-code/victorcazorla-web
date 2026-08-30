/**
 * Google Analytics 4 (gtag.js) — carga condicionada al consentimiento.
 *
 * - Solo en producción (no en localhost ni en *.pages.dev).
 * - La librería NO se descarga hasta que el visitante pulsa «Aceptar»
 *   en el aviso de cookies (cookie-consent.js). Si rechaza o no
 *   responde, no se carga gtag.js ni se instala ninguna cookie.
 * - Aquí solo se define `window.loadAnalytics()` (idempotente) y se
 *   llama de inmediato si ya había consentimiento guardado de una
 *   visita anterior. El resto lo dispara cookie-consent.js.
 *
 * Las visitas propias del responsable se excluyen aparte, con una regla
 * de «tráfico interno» por IP en la configuración de GA4.
 */
import { isProductionHost } from "./lib/production-host.js";
import { readConsent } from "./lib/consent-store.js";

const MEASUREMENT_ID = "G-3GQEMTYB7S";

if (isProductionHost(window.location.hostname)) {
  window.loadAnalytics = function loadAnalytics() {
    if (window.__analyticsLoaded) return;
    window.__analyticsLoaded = true;

    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", MEASUREMENT_ID);

    // Inyección con .src (no inline): la CSP de public/_headers ya
    // permite www.googletagmanager.com en script-src.
    const tag = document.createElement("script");
    tag.async = true;
    tag.src = "https://www.googletagmanager.com/gtag/js?id=" + MEASUREMENT_ID;
    document.head.appendChild(tag);
  };

  const consent = readConsent();
  if (consent && consent.accepted) {
    window.loadAnalytics();
  }
}
