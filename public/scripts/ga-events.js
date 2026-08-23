/**
 * Google Analytics 4 - eventos personalizados
 * Delegación de clics sobre document.body: cubre descargas de archivos,
 * clics de contacto (mailto), enlaces salientes (perfiles profesionales
 * y otros dominios externos) y cambios de idioma.
 */
import { classify, fileName } from "./lib/click-classify.js";

function send(name, params) {
  if (typeof window.gtag === "function") {
    window.gtag("event", name, params);
  }
}

function trackLinkClicks() {
  var hostname = window.location.hostname;

  document.body.addEventListener("click", function (event) {
    var link = event.target.closest ? event.target.closest("a[href]") : null;
    if (!link) return;

    var href = link.getAttribute("href");
    if (!href) return;

    var info = classify(href, hostname, window.location.href);
    if (!info) return;

    var linkText = link.textContent.trim() || link.getAttribute("title") || href;

    if (info.type === "download") {
      send("file_download", {
        file_extension: info.ext,
        file_name: fileName(href.split("?")[0].split("#")[0]),
        link_url: href,
        link_text: linkText,
      });
    } else if (info.type === "contact") {
      send("contact_click", {
        method: "email",
        link_text: linkText,
        page_location: window.location.href,
      });
    } else if (info.type === "outbound") {
      send("click", {
        link_url: href,
        link_domain: info.hostname,
        link_text: linkText,
        outbound: true,
        event_category: info.professional ? "professional_profile" : "external_link",
      });
    }
  });
}

function trackLanguageSwitch() {
  document.querySelectorAll(".lang-switch, .flag-btn").forEach(function (el) {
    el.addEventListener("click", function () {
      send("language_switch", {
        target_language: (el.textContent || "").trim(),
        target_url: el.getAttribute("href") || "",
        page_location: window.location.href,
      });
    });
  });
}

function init() {
  trackLinkClicks();
  trackLanguageSwitch();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
