import { test, expect, type Page } from "@playwright/test";

// El aviso solo se muestra fuera de localhost, o con `?cookie-consent`
// en la URL (modo previsualización/test: aparece al instante e ignora
// una decisión ya guardada).
const FORCED = "/?cookie-consent";

function readStoredConsent(page: Page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem("cookie-consent");
    return raw ? JSON.parse(raw) : null;
  });
}

test.describe("Cookie consent banner", () => {
  test("está en el DOM pero oculto en una carga normal sin decisión previa", async ({ page }) => {
    await page.goto("/");
    const banner = page.locator("#cookie-consent");
    await expect(banner).toBeAttached();
    await expect(banner).toBeHidden();
    // Sin consentimiento, gtag.js no debe cargarse.
    await expect(page.locator('script[src*="googletagmanager.com/gtag/js"]')).toHaveCount(0);
  });

  test("con ?cookie-consent aparece, como región con nombre y con lo esencial", async ({ page }) => {
    await page.goto(FORCED);
    const banner = page.locator("#cookie-consent");
    await expect(banner).toBeVisible();
    await expect(banner).toHaveAttribute("role", "region");
    await expect(banner).toHaveAttribute("aria-label", /.+/);

    await expect(banner.getByRole("heading")).toHaveText("Cookies");
    await expect(banner.getByRole("link", { name: /más información/i })).toHaveAttribute("href", "/legal/");
    await expect(banner.getByRole("button", { name: "Aceptar" })).toBeVisible();
    await expect(banner.getByRole("button", { name: "Rechazar" })).toBeVisible();
  });

  test("mueve el foco al panel al aparecer", async ({ page }) => {
    await page.goto(FORCED);
    await expect(page.locator("#cookie-consent")).toBeVisible();
    const panelIsFocused = await page.evaluate(
      () => document.activeElement === document.querySelector("#cookie-consent [data-consent-panel]")
    );
    expect(panelIsFocused).toBe(true);
  });

  test("Tab recorre enlace -> Rechazar -> Aceptar", async ({ page }) => {
    await page.goto(FORCED);
    await expect(page.locator("#cookie-consent")).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(page.locator("#cookie-consent a:focus")).toHaveText(/más información/i);
    await page.keyboard.press("Tab");
    await expect(page.locator("#cookie-consent button:focus")).toHaveText("Rechazar");
    await page.keyboard.press("Tab");
    await expect(page.locator("#cookie-consent button:focus")).toHaveText("Aceptar");
  });

  test("Escape cierra sin guardar nada", async ({ page }) => {
    await page.goto(FORCED);
    await expect(page.locator("#cookie-consent")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#cookie-consent")).toBeHidden();
    expect(await readStoredConsent(page)).toBeNull();
  });

  test("Rechazar guarda {accepted:false} y no carga gtag.js", async ({ page }) => {
    await page.goto(FORCED);
    await page.getByRole("button", { name: "Rechazar" }).click();
    await expect(page.locator("#cookie-consent")).toBeHidden();

    const stored = await readStoredConsent(page);
    expect(stored).toMatchObject({ accepted: false, version: 1 });
    expect(typeof stored.timestamp).toBe("number");
    await expect(page.locator('script[src*="googletagmanager.com/gtag/js"]')).toHaveCount(0);
  });

  test("Aceptar guarda {accepted:true}", async ({ page }) => {
    await page.goto(FORCED);
    await page.getByRole("button", { name: "Aceptar" }).click();
    await expect(page.locator("#cookie-consent")).toBeHidden();

    const stored = await readStoredConsent(page);
    expect(stored).toMatchObject({ accepted: true, version: 1 });
    expect(typeof stored.timestamp).toBe("number");
  });

  test("tras decidir, una carga normal ya no muestra el aviso", async ({ page }) => {
    await page.goto(FORCED);
    await page.getByRole("button", { name: "Rechazar" }).click();
    await page.goto("/");
    await expect(page.locator("#cookie-consent")).toBeHidden();
  });

  test("los botones cumplen el área táctil mínima (>= 44px de alto)", async ({ page }) => {
    await page.goto(FORCED);
    await expect(page.locator("#cookie-consent")).toBeVisible();
    for (const name of ["Aceptar", "Rechazar"]) {
      const box = await page.getByRole("button", { name }).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  });
});
