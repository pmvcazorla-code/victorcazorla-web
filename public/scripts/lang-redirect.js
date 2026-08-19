(function () {
  var STORAGE_KEY = "vcf_lang_seen";
  var HOME_BY_LANG = { en: "/en", fr: "/fr", ca: "/ca" };

  try {
    if (localStorage.getItem(STORAGE_KEY)) {
      // Ya hemos visto a este visitante antes (en esta u otra página):
      // no lo movemos de donde haya decidido ir.
      return;
    }

    var currentLang = document.documentElement.lang || "es";
    var path = window.location.pathname;
    var isSpanishHome = path === "/" && currentLang === "es";

    if (!isSpanishHome) {
      // Ha entrado directamente en una página con idioma ya explícito
      // (enlace compartido, buscador, etc.): no redirigimos, solo
      // recordamos que ya ha estado aquí.
      localStorage.setItem(STORAGE_KEY, currentLang);
      return;
    }

    var browserLangs = navigator.languages && navigator.languages.length
      ? navigator.languages
      : [navigator.language || ""];

    var target = null;
    for (var i = 0; i < browserLangs.length; i++) {
      var code = (browserLangs[i] || "").toLowerCase().split("-")[0];
      if (code === "es") break; // el español ya es lo que se está mostrando
      if (HOME_BY_LANG[code]) {
        target = HOME_BY_LANG[code];
        break;
      }
    }

    if (target) {
      localStorage.setItem(STORAGE_KEY, target.slice(1));
      window.location.replace(target);
    } else {
      localStorage.setItem(STORAGE_KEY, "es");
    }
  } catch (e) {
    // localStorage bloqueado (modo privado, etc.): no hacemos nada,
    // simplemente se queda en español por defecto.
  }
})();
