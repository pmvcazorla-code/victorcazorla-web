// Minimal static file server for `dist/`, used only to run the Playwright
// suite. Mirrors the parts of Cloudflare Pages' static routing that the
// tests rely on: directory URLs resolve to their index.html, and any path
// with no matching file falls back to 404.html with an actual 404 status.
// `astro preview` isn't used here because in this environment it detaches
// into a background daemon and returns immediately, which Playwright's
// webServer launcher treats as "the process exited early".
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const ROOT = new URL("../dist/", import.meta.url).pathname;
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 4321);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

async function resolveFile(pathname) {
  const safePath = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  const candidates = safePath.endsWith("/")
    ? [join(ROOT, safePath, "index.html")]
    : [join(ROOT, safePath), join(ROOT, safePath, "index.html")];

  for (const candidate of candidates) {
    try {
      const info = await stat(candidate);
      if (info.isFile()) return candidate;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const filePath = await resolveFile(url.pathname);

  if (filePath) {
    const body = await readFile(filePath);
    res.writeHead(200, { "Content-Type": MIME_TYPES[extname(filePath)] ?? "application/octet-stream" });
    res.end(body);
    return;
  }

  const notFoundPath = join(ROOT, "404.html");
  try {
    const body = await readFile(notFoundPath);
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
});

server.listen(PORT, () => {
  console.log(`Static server ready at http://localhost:${PORT}`);
});
