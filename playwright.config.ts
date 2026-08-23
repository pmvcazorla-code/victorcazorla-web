import { defineConfig, devices } from "@playwright/test";

const PORT = 4321;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    // El sitio redirige a los visitantes primerizos a /en|fr|ca/ según su
    // idioma de navegador (public/scripts/lang-redirect.js). Playwright usa
    // en-US por defecto, lo que dispararía ese redirect y rompería
    // silenciosamente cualquier test que navegue a "/" esperando español.
    locale: "es-ES",
  },
  webServer: {
    command: `npm run build && node tests/static-server.mjs ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
