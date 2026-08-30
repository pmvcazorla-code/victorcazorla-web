/**
 * Aviso de cookies: muestra el banner solo si hace falta decidir,
 * guarda la decisión y, si es «Aceptar», arranca Google Analytics sin
 * recargar la página.
 *
 * No es un modal: no atrapa el foco ni bloquea el resto de la página
 * (eso sería un «muro de cookies»). Solo mueve el foco al panel cuando
 * aparece, para que quien navega con teclado o lector de pantalla lo
 * encuentre de inmediato, y lo devuelve al cerrarse.
 *
 * Se muestra en producción y en las previews (*.pages.dev). En local no,
 * salvo que se añada `?cookie-consent` a la URL (para previsualizarlo o
 * para los tests e2e); en ese modo aparece al instante e ignora una
 * decisión ya guardada.
 */
import { isLocalHost } from "./lib/production-host.js";
import { readConsent, writeConsent } from "./lib/consent-store.js";

const SHOW_DELAY_MS = 2500;

function init() {
  const forced = new URLSearchParams(window.location.search).has("cookie-consent");
  if (!forced && isLocalHost(window.location.hostname)) return;

  const banner = document.getElementById("cookie-consent");
  if (!banner) return;

  // Si ya hay una decisión válida (aceptada o rechazada), no se muestra.
  // gtag-init.js ya se habrá encargado de cargar la analítica si procede.
  if (!forced && readConsent()) return;

  const panel = banner.querySelector("[data-consent-panel]");
  const acceptBtn = banner.querySelector('[data-consent="accept"]');
  const rejectBtn = banner.querySelector('[data-consent="reject"]');
  if (!panel || !acceptBtn || !rejectBtn) return;

  let previousFocus = null;
  const timer = window.setTimeout(show, forced ? 0 : SHOW_DELAY_MS);

  function show() {
    previousFocus = document.activeElement;
    banner.hidden = false;
    // Doble rAF: deja que el navegador pinte el estado inicial (oculto)
    // antes de activar la transición de entrada.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => banner.classList.add("cookie-consent--visible"));
    });
    panel.focus();
    document.addEventListener("keydown", onKeydown);
  }

  function close() {
    window.clearTimeout(timer);
    document.removeEventListener("keydown", onKeydown);
    banner.classList.remove("cookie-consent--visible");
    banner.hidden = true;

    const restore =
      previousFocus && previousFocus !== document.body && document.contains(previousFocus)
        ? previousFocus
        : document.getElementById("main-content");
    if (restore && typeof restore.focus === "function") restore.focus();
  }

  function onKeydown(event) {
    // Escape = cerrar sin decidir: no se guarda nada, la analítica sigue
    // sin cargarse y el aviso reaparecerá en la próxima visita.
    if (event.key === "Escape") {
      event.stopPropagation();
      close();
    }
  }

  acceptBtn.addEventListener("click", () => {
    writeConsent(true);
    close();
    if (typeof window.loadAnalytics === "function") window.loadAnalytics();
  });

  rejectBtn.addEventListener("click", () => {
    writeConsent(false);
    close();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
