import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov", "json-summary"],
      reportsDirectory: "coverage",
      include: [
        "src/data/i18n.ts",
        "src/pages/sitemap.xml.ts",
        "src/utils/obfuscate.ts",
        "public/scripts/lib/click-classify.js",
        "public/scripts/lib/contact-form-validate.js",
        "functions/_lib/contact.ts",
        "functions/_lib/captcha.ts",
        "functions/api/contact.ts",
      ],
    },
  },
});
