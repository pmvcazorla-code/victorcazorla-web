import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://victorcazorla.com',
  // Cloudflare Pages 308-redirects any request without a trailing slash to
  // the trailing-slash version (e.g. /formacion -> /formacion/). Matching
  // that here means Astro.url.pathname, the sitemap, canonical tags and
  // hreflang alternates all already point at the final URL, so Google (and
  // visitors) never hit that redirect hop when following our own links.
  trailingSlash: 'always',
});
