import { test, expect } from "@playwright/test";

test.describe("Sitemap", () => {
  test("is served as XML with one entry per route/language", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/xml");

    const body = await response.text();
    const urlCount = (body.match(/<url>/g) ?? []).length;
    expect(urlCount).toBe(28); // 7 rutas (home, it, ciencias, deontología, formación, legal, contacto) x 4 idiomas
    expect(body).toContain("<loc>https://victorcazorla.com/</loc>");
  });

  test("robots.txt points at the sitemap", async ({ request }) => {
    const response = await request.get("/robots.txt");
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toContain("Sitemap: https://victorcazorla.com/sitemap.xml");
  });
});
