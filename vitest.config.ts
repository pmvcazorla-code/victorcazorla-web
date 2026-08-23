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
        "public/scripts/lib/click-classify.js",
      ],
    },
  },
});
