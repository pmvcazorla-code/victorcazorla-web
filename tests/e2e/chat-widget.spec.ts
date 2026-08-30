import { test, expect, type Page } from "@playwright/test";

// El servidor estático de tests no ejecuta Pages Functions, así que
// /api/chat se intercepta aquí para probar el comportamiento del widget
// (no la disponibilidad de AI Search).
async function mockChat(page: Page, body: unknown, status = 200) {
  await page.route("**/api/chat", (route) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    })
  );
}

test.describe("Chat widget (home)", () => {
  test("the launcher is revealed by JS and the panel starts hidden", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("[data-chat-toggle]")).toBeVisible();
    await expect(page.locator("[data-chat-panel]")).toBeHidden();
  });

  test("opens with a greeting, closes with Escape", async ({ page }) => {
    await page.goto("/");
    await page.click("[data-chat-toggle]");
    const panel = page.locator("[data-chat-panel]");
    await expect(panel).toBeVisible();
    await expect(page.locator("[data-chat-log] .chat-msg--assistant")).toContainText("Víctor Cazorla");
    await expect(page.locator("[data-chat-input]")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
  });

  test("sends a question and renders the answer with a source link", async ({ page }) => {
    await mockChat(page, {
      ok: true,
      answer: "Es perito judicial ambiental de la Generalitat de Catalunya.",
      sources: [{ title: "Ciencias Ambientales", url: "https://victorcazorla.com/cienciasambientales/" }],
    });
    await page.goto("/");
    await page.click("[data-chat-toggle]");
    await page.fill("[data-chat-input]", "¿A qué se dedica?");
    await page.click("[data-chat-send]");

    await expect(page.locator("[data-chat-log] .chat-msg--user")).toHaveText("¿A qué se dedica?");
    await expect(page.locator("[data-chat-log] .chat-msg--assistant").last()).toContainText(
      "perito judicial ambiental"
    );
    await expect(
      page.locator('[data-chat-log] .chat-msg__sources a[href="https://victorcazorla.com/cienciasambientales/"]')
    ).toBeVisible();
  });

  test("shows a friendly error when the backend rate-limits", async ({ page }) => {
    await mockChat(page, { ok: false, error: "rate_limited" }, 429);
    await page.goto("/");
    await page.click("[data-chat-toggle]");
    await page.fill("[data-chat-input]", "Otra pregunta");
    await page.click("[data-chat-send]");
    await expect(page.locator("[data-chat-log] .chat-msg--error")).toContainText("muchas preguntas");
  });

  test("the disclaimer links to the privacy policy", async ({ page }) => {
    await page.goto("/");
    await page.click("[data-chat-toggle]");
    await expect(page.locator('[data-chat-form] ~ .chat__disclaimer a[href="/legal/"]')).toBeVisible();
  });

  test.describe("on a phone viewport", () => {
    test.use({ viewport: { width: 375, height: 667 }, reducedMotion: "reduce" });

    test("the launcher is reachable and the panel fills the screen above the header", async ({ page }) => {
      await mockChat(page, { ok: true, answer: "Es científico ambiental.", sources: [] });
      await page.goto("/");

      const toggle = page.locator("[data-chat-toggle]");
      await expect(toggle).toBeVisible();
      // El icono cabe en la pantalla y no lo tapa nada: es clicable.
      await toggle.click();

      const panel = page.locator("[data-chat-panel]");
      await expect(panel).toBeVisible();
      const box = await panel.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(370); // hoja a pantalla completa
      expect(box?.y ?? 999).toBeLessThan(20); // pegada arriba, no una tarjeta anclada abajo
      expect(box?.height ?? 0).toBeGreaterThan(600); // ocupa casi toda la altura

      // El widget está por encima del header pegajoso.
      const z = await panel.evaluate((el) => getComputedStyle(el.closest(".chat")!).zIndex);
      expect(Number(z)).toBeGreaterThan(100);

      await page.fill("[data-chat-input]", "¿a qué se dedica?");
      await page.click("[data-chat-send]");
      await expect(page.locator("[data-chat-log] .chat-msg--assistant").last()).toContainText(
        "científico ambiental"
      );
    });
  });
});
