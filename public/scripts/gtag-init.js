/**
 * Inicialización de Google Analytics 4 (gtag.js).
 *
 * Solo se activa en el sitio en producción. En desarrollo local
 * (localhost) y en los despliegues de vista previa de Cloudflare Pages
 * (*.pages.dev) no se carga la librería ni se envía nada: ese tráfico
 * no son visitas reales y, si se contara, inflaría los informes.
 *
 * Las visitas propias (del responsable del sitio) NO se marcan aquí:
 * se excluyen en la configuración de GA4 con una regla de "tráfico
 * interno" por IP. Marcarlas en el config (traffic_type: "internal")
 * etiquetaba TODAS las visitas como internas, no solo las propias.
 */
(function () {
  var host = window.location.hostname;
  var isProduction =
    host !== "localhost" &&
    host !== "127.0.0.1" &&
    host !== "[::1]" &&
    !host.endsWith(".pages.dev");

  if (!isProduction) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    dataLayer.push(arguments);
  };
  gtag("js", new Date());
  gtag("config", "G-3GQEMTYB7S");

  // Carga la librería de gtag.js solo cuando de verdad se va a usar.
  // Antes iba como <script async src> fijo en el <head> de
  // BaseLayout.astro; moverlo aquí evita descargarla en local y en las
  // vistas previa. La CSP de public/_headers ya permite este origen en
  // script-src; al inyectarse con .src (no inline) no hace falta
  // 'unsafe-inline'.
  var s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=G-3GQEMTYB7S";
  document.head.appendChild(s);
})();
