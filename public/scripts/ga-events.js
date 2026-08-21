/**
 * Google Analytics 4 Custom Events
 * Tracks clicks on external links, PDFs, and important resources
 */
(function () {
  // Esperar a que gtag esté disponible
  function trackLinkClicks() {
    const links = document.querySelectorAll('a[href]');
    const currentDomain = window.location.hostname;

    links.forEach((link) => {
      link.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (!href) return;

        // Ignorar enlaces internos (del mismo dominio) que no sean PDFs/recursos especiales
        const isExternal = !href.includes(currentDomain) && href.startsWith('http');
        const isPdf = href.toLowerCase().endsWith('.pdf');
        const isResource =
          href.includes('linkedin.com') ||
          href.includes('orcid.org') ||
          href.includes('credly.com') ||
          href.includes('researchgate') ||
          href.includes('arxiv') ||
          href.includes('doi.org') ||
          href.includes('scholar.google');

        if (isExternal || isPdf || isResource) {
          const linkText = this.textContent.trim() || this.getAttribute('title') || href;
          const eventLabel = isPdf ? `PDF: ${linkText}` : `Link: ${linkText}`;

          gtag('event', 'link_click', {
            link_url: href,
            link_text: eventLabel,
            event_category: isPdf ? 'pdf' : isExternal ? 'external_link' : 'resource',
            timestamp: new Date().toISOString(),
          });
        }
      });
    });
  }

  // Ejecutar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', trackLinkClicks);
  } else {
    trackLinkClicks();
  }
})();
