import { routes, languages } from "../data/i18n";

export const prerender = true;
const siteUrl = "https://victorcazorla.es";

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");

const buildDate = new Date().toISOString().split("T")[0];

const routePriority: Record<string, string> = {
  home: "1.0",
  it: "0.8",
  environmentalScience: "0.8",
  ethics: "0.8",
  education: "0.8",
};

const sitemapEntries = routes.flatMap((route) =>
  languages.map((language) => ({
    url: `${siteUrl}${route.slugs[language.code]}`,
    lastmod: buildDate,
    changefreq: "monthly",
    priority: routePriority[route.key] ?? "0.6",
    alternates: [
      ...languages.map((alternate) => ({
        hreflang: alternate.code,
        href: `${siteUrl}${route.slugs[alternate.code]}`,
      })),
      { hreflang: "x-default", href: `${siteUrl}${route.slugs.es}` },
    ],
  }))
);

export function GET() {
  const content = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${sitemapEntries
    .map(
      (entry) =>
        `<url><loc>${escapeXml(entry.url)}</loc><lastmod>${escapeXml(entry.lastmod)}</lastmod><changefreq>${escapeXml(entry.changefreq)}</changefreq><priority>${escapeXml(entry.priority)}</priority>${entry.alternates
          .map(
            (alternate) =>
              `<xhtml:link rel="alternate" hreflang="${escapeXml(
                alternate.hreflang
              )}" href="${escapeXml(alternate.href)}"/>`
          )
          .join("")}</url>`
    )
    .join("\n")}
</urlset>`;

  return new Response(content, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
