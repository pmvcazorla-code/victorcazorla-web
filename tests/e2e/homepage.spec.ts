import { test, expect } from "@playwright/test";

test.describe("Home page", () => {
  test("has exactly one h1 and it is the site title", async ({ page }) => {
    await page.goto("/");
    const h1 = page.locator("h1");
    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText("Víctor Cazorla Fernández");
  });

  test("has exactly one main landmark", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("main")).toHaveCount(1);
  });

  test("sets title, meta description and canonical URL", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Víctor Cazorla Fernández/);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /.+/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://victorcazorla.com/");
  });

  test("skip link is the first focusable element and points at #main-content", async ({ page }) => {
    await page.goto("/");
    const skipLink = page.locator(".skip-link");
    await expect(skipLink).toHaveAttribute("href", "#main-content");
    await page.keyboard.press("Tab");
    await expect(skipLink).toBeFocused();
  });

  test("does not have a BreadcrumbList schema (it's the root page)", async ({ page }) => {
    await page.goto("/");
    const jsonLdBlocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    const hasBreadcrumb = jsonLdBlocks.some((json) => json.includes("BreadcrumbList"));
    expect(hasBreadcrumb).toBe(false);
  });
});
