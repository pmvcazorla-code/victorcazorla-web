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
    await expect(page.locator("[data-error-for=reason]")).not.toHaveText("");
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
    await page.selectOption("#contact-reason", "academic");
    await page.fill("#contact-message", "Hola, quería hacerte una consulta profesional.");
    await page.check("#contact-consent");
    await page.click("button[type=submit]");

    await expect(page.locator("[data-error-for=name]")).toHaveText("");
    await expect(page.locator("[data-error-for=reason]")).toHaveText("");
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
    await page.selectOption("#contact-reason", "academic");
    await page.fill("#contact-message", "Hola, quería hacerte una consulta profesional.");
    await page.check("#contact-consent");
    await page.click("button[type=submit]");

    await expect(page.locator("[data-contact-status]")).not.toHaveText("");
  });

  test("cannot be submitted with only the placeholder reason selected", async ({ page }) => {
    await page.goto("/contacto/");
    await page.fill("#contact-name", "Ana García");
    await page.fill("#contact-email", "ana@example.com");
    await page.fill("#contact-message", "Hola, quería hacerte una consulta profesional.");
    await page.check("#contact-consent");
    await page.click("button[type=submit]");

    await expect(page.locator("[data-error-for=reason]")).not.toHaveText("");
  });

  // Regresión: la opción placeholder ("") era a la vez disabled y
  // selected. Esa combinación es un caso límite conocido en algunos
  // navegadores WebKit, donde select.value puede seguir devolviendo ""
  // aunque el usuario elija visualmente otra opción, dejando el error
  // "Selecciona una razón de contacto." clavado en rojo sin poder
  // enviar. value="" solo (sin disabled) evita el caso límite.
  test("the placeholder reason option is not disabled, to avoid a WebKit select-value quirk", async ({ page }) => {
    await page.goto("/contacto/");
    await expect(page.locator('#contact-reason option[value=""]')).not.toHaveAttribute("disabled", "");
  });

  test("selecting each reason option updates the select's value correctly", async ({ page }) => {
    await page.goto("/contacto/");
    const reasons = [
      "it_opportunities",
      "science_research",
      "philosophy_research",
      "professional_ethics",
      "academic",
      "other",
    ];
    for (const reason of reasons) {
      await page.selectOption("#contact-reason", reason);
      await expect(page.locator("#contact-reason")).toHaveValue(reason);
    }
  });
});
