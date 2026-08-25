import { test, expect } from "@playwright/test";

test.describe("Contact form", () => {
  test("has exactly one h1 and a link to the privacy policy", async ({ page }) => {
    await page.goto("/contacto/");
    await expect(page.locator("h1")).toHaveText("Contacto");
    await expect(page.locator(".contact-form a[href='/legal/']")).toBeVisible();
  });

  test("the honeypot field is in the DOM (for bots) but positioned off-screen and untabbable (for people)", async ({ page }) => {
    await page.goto("/contacto/");
    const honeypot = page.locator("#contact-company");
    await expect(honeypot).toBeAttached();
    await expect(honeypot).toHaveAttribute("tabindex", "-1");
    // toBeHidden() doesn't apply here: an off-screen field still has a
    // non-zero box and no display:none, which is exactly what lets a
    // bot reading the DOM/CSSOM (without rendering) still find it.
    const box = await honeypot.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeLessThan(0);
  });

  test("blocks submission and shows field errors when required fields are empty", async ({ page }) => {
    await page.goto("/contacto/");
    await page.click("button[type=submit]");
    await expect(page.locator("[data-error-for=name]")).not.toHaveText("");
    await expect(page.locator("[data-error-for=email]")).not.toHaveText("");
    await expect(page.locator("[data-error-for=message]")).not.toHaveText("");
    await expect(page.locator("[data-error-for=consent]")).not.toHaveText("");
    await expect(page.locator("[data-contact-status]")).not.toHaveText("");
  });

  test("clears a field's error once it is filled in and resubmitted", async ({ page }) => {
    await page.goto("/contacto/");
    await page.click("button[type=submit]");
    await expect(page.locator("[data-error-for=name]")).not.toHaveText("");

    await page.fill("#contact-name", "Ana García");
    await page.fill("#contact-email", "ana@example.com");
    await page.fill("#contact-message", "Hola, quería hacerte una consulta profesional.");
    await page.check("#contact-consent");
    await page.click("button[type=submit]");

    await expect(page.locator("[data-error-for=name]")).toHaveText("");
  });

  // El servidor estático de tests/static-server.mjs no ejecuta Pages
  // Functions, así que /api/contact no existe en este entorno: un envío
  // válido siempre cae en la rama de error genérico. Sirve para
  // comprobar que el formulario degrada con un mensaje visible en vez
  // de quedarse callado o lanzar una excepción sin capturar.
  test("shows a status message after a well-formed submission even when the backend is unreachable", async ({ page }) => {
    await page.goto("/contacto/");
    await page.fill("#contact-name", "Ana García");
    await page.fill("#contact-email", "ana@example.com");
    await page.fill("#contact-message", "Hola, quería hacerte una consulta profesional.");
    await page.check("#contact-consent");
    await page.click("button[type=submit]");

    await expect(page.locator("[data-contact-status]")).not.toHaveText("");
  });
});
