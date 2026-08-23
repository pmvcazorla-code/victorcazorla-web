import { describe, expect, it } from "vitest";
import { routes, languages } from "../../src/data/i18n";
import { GET, escapeXml } from "../../src/pages/sitemap.xml.ts";

describe("escapeXml", () => {
  it("escapes all five XML special characters", () => {
    expect(escapeXml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&apos;");
  });

  it("leaves ordinary text untouched", () => {
    expect(escapeXml("Ciències Ambientals")).toBe("Ciències Ambientals");
  });
});

describe("GET /sitemap.xml", () => {
  const response = GET();
  const bodyPromise = response.text();

  it("responds with an XML content type", () => {
    expect(response.headers.get("Content-Type")).toBe("application/xml; charset=utf-8");
  });

  it("includes exactly one <url> entry per route/language combination, plus static pages", async () => {
    const body = await bodyPromise;
    const urlCount = (body.match(/<url>/g) ?? []).length;
    // +1 for /legal/, a static page outside `routes` (no i18n alternates).
    expect(urlCount).toBe(routes.length * languages.length + 1);
  });

  it("includes the /legal/ page without language alternates", async () => {
    const body = await bodyPromise;
    expect(body).toContain("<loc>https://victorcazorla.com/legal/</loc>");
    const legalEntry = body.split("<loc>https://victorcazorla.com/legal/</loc>")[1]?.split("</url>")[0];
    expect(legalEntry).not.toContain("hreflang");
  });

  it("includes every route slug, for every language, as an absolute URL", async () => {
    const body = await bodyPromise;
    for (const route of routes) {
      for (const language of languages) {
        expect(body).toContain(`<loc>https://victorcazorla.com${route.slugs[language.code]}</loc>`);
      }
    }
  });

  it("adds an x-default hreflang alternate pointing at the Spanish URL for every entry", async () => {
    const body = await bodyPromise;
    const xDefaultCount = (body.match(/hreflang="x-default"/g) ?? []).length;
    expect(xDefaultCount).toBe(routes.length * languages.length);
  });

  it("gives the homepage the highest priority", async () => {
    const body = await bodyPromise;
    expect(body).toMatch(
      /<loc>https:\/\/victorcazorla\.com\/<\/loc><lastmod>[^<]+<\/lastmod><changefreq>monthly<\/changefreq><priority>1\.0<\/priority>/
    );
  });
});
