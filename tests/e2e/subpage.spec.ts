import { test, expect } from "@playwright/test";

test.describe("Subpage (Deontología)", () => {
  test("has exactly one h1, matching the page topic, distinct from the site title", async ({ page }) => {
    await page.goto("/deontologia/");
    const h1 = page.locator("h1");
    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText("Deontología y Ética Profesional");
  });

  test("still shows the site brand in the header, but not as an h1", async ({ page }) => {
    await page.goto("/deontologia/");
    const brand = page.locator(".site-title");
    await expect(brand).toHaveText("Víctor Cazorla Fernández");
    await expect(page.locator("header h1")).toHaveCount(0);
  });

  test("has exactly one main landmark (no nested <main>)", async ({ page }) => {
    await page.goto("/deontologia/");
    await expect(page.locator("main")).toHaveCount(1);
  });

  test("includes a BreadcrumbList JSON-LD schema back to the home page", async ({ page }) => {
    await page.goto("/deontologia/");
    const jsonLdBlocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    const breadcrumb = jsonLdBlocks.map((json) => JSON.parse(json)).find((data) => data["@type"] === "BreadcrumbList");
    expect(breadcrumb).toBeDefined();
    expect(breadcrumb.itemListElement[0].item).toBe("https://victorcazorla.com/");
    expect(breadcrumb.itemListElement[1].item).toBe("https://victorcazorla.com/deontologia/");
  });

  test("uses a PNG og:image with declared dimensions", async ({ page }) => {
    await page.goto("/deontologia/");
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      "https://victorcazorla.com/images/og/deontologia.png"
    );
    await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute("content", "1200");
    await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute("content", "630");
  });
});
