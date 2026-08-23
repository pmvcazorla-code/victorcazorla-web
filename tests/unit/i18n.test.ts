import { describe, expect, it } from "vitest";
import { routes, navItems, languages } from "../../src/data/i18n";

const LANG_CODES = ["es", "en", "fr", "ca"] as const;

describe("i18n route data", () => {
  it("declares exactly the four supported languages", () => {
    expect(languages.map((l) => l.code).sort()).toEqual([...LANG_CODES].sort());
  });

  it("gives every route a non-empty slug and label for all four languages", () => {
    for (const route of routes) {
      for (const code of LANG_CODES) {
        expect(route.slugs[code], `${route.key}.slugs.${code}`).toBeTruthy();
        expect(route.labels[code], `${route.key}.labels.${code}`).toBeTruthy();
      }
    }
  });

  it("uses '/' for the Spanish home slug and a trailing slash everywhere else", () => {
    const home = routes.find((r) => r.key === "home")!;
    expect(home.slugs.es).toBe("/");

    for (const route of routes) {
      for (const code of LANG_CODES) {
        const slug = route.slugs[code];
        expect(slug.startsWith("/"), `${route.key}.slugs.${code} should start with /`).toBe(true);
        if (slug !== "/") {
          expect(slug.endsWith("/"), `${route.key}.slugs.${code} should end with / (trailingSlash: 'always')`).toBe(
            true
          );
        }
      }
    }
  });

  it("never assigns the same URL slug to two different routes", () => {
    const allSlugs = routes.flatMap((route) => LANG_CODES.map((code) => route.slugs[code]));
    expect(new Set(allSlugs).size).toBe(allSlugs.length);
  });

  it("builds one nav item per route for each language, in route order", () => {
    for (const code of LANG_CODES) {
      expect(navItems[code]).toHaveLength(routes.length);
      navItems[code].forEach((item, i) => {
        expect(item.href).toBe(routes[i].slugs[code]);
        expect(item.label).toBe(routes[i].labels[code]);
      });
    }
  });
});
