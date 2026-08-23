import { test, expect } from "@playwright/test";

test.describe("404 page", () => {
  test("is served for an unknown path and tells search engines not to index it", async ({ page }) => {
    const response = await page.goto("/this-page-does-not-exist/");
    expect(response?.status()).toBe(404);
    await expect(page.locator("h1")).toHaveText("Página no encontrada");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, follow");
  });

  test("has exactly one main landmark and offers a way back home", async ({ page }) => {
    await page.goto("/this-page-does-not-exist/");
    await expect(page.locator("main")).toHaveCount(1);
    await page.getByRole("link", { name: /volver al inicio/i }).click();
    await expect(page).toHaveURL("/");
  });
});
