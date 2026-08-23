import { test, expect } from "@playwright/test";

test.describe("Language switcher", () => {
  test("switching to English updates the URL and the html lang attribute", async ({ page }) => {
    await page.goto("/deontologia/");
    await page.getByRole("link", { name: "English" }).click();
    await expect(page).toHaveURL("/en/ethics/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("h1")).toHaveText("Ethics and Professional Deontology");
  });

  test("the active language is marked with aria-current", async ({ page }) => {
    await page.goto("/fr/it/");
    await expect(page.getByRole("link", { name: "Français" })).toHaveAttribute("aria-current", "page");
  });
});

test.describe("Main navigation", () => {
  test("nav links reach every top-level section from the home page", async ({ page }) => {
    await page.goto("/");
    await page.locator("header").getByRole("link", { name: "Formación" }).first().click();
    await expect(page).toHaveURL("/formacion/");
    await expect(page.locator("h1")).toHaveText("Formación Académica Universitaria");
  });
});
