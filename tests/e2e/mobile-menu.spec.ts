import { test, expect } from "@playwright/test";

test.describe("Mobile menu", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("toggles the panel and flips aria-expanded on click", async ({ page }) => {
    await page.goto("/");
    const menuBtn = page.locator("#mobile-menu-btn");
    const menuPanel = page.locator("#mobile-menu-panel");

    await expect(menuBtn).toHaveAttribute("aria-expanded", "false");
    await expect(menuPanel).not.toHaveClass(/open/);

    await menuBtn.click();
    await expect(menuBtn).toHaveAttribute("aria-expanded", "true");
    await expect(menuPanel).toHaveClass(/open/);

    await menuBtn.click();
    await expect(menuBtn).toHaveAttribute("aria-expanded", "false");
    await expect(menuPanel).not.toHaveClass(/open/);
  });

  test("panel links navigate to the right section", async ({ page }) => {
    await page.goto("/");
    await page.locator("#mobile-menu-btn").click();
    await page.locator("#mobile-menu-panel").getByRole("link", { name: "Ciencias Ambientales" }).click();
    await expect(page).toHaveURL("/cienciasambientales/");
  });
});
