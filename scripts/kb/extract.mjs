#!/usr/bin/env node
// Extrae el contenido principal de cada página ya compilada en dist/ y lo
// convierte a Markdown ligero dentro de .kb/, que luego kb:bundle
// empaqueta para el chatbot. Sin dependencias (solo regex sobre el HTML
// que genera Astro, que es predecible) y sin red: lee dist/, escribe .kb/.
//
// Uso:  npm run build && npm run kb:extract
//
// La salida imita la estructura de URLs del sitio:
//   /                -> .kb/site/home.md
//   /en/ethics/      -> .kb/site/en/ethics.md
//   /formacion/      -> .kb/site/formacion.md
// Cada archivo lleva frontmatter YAML (title, url, lang, source, updated).

import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("../../", import.meta.url));
const DIST = join(REPO, "dist");
const OUT = join(REPO, ".kb");
const SITE = "https://victorcazorla.com";
const SITE_HOST = "victorcazorla.com";

const SKIP = new Set(["404.html"]);

// Bloques que se eliminan enteros del <main> antes de convertir.
const DROP_BLOCKS = ["script", "style", "svg", "nav", "footer", "form", "noscript", "button", "template", "h1"];

function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&nbsp;/g, " ")
    .replace(/&hellip;/g, "…")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&laquo;/g, "«")
    .replace(/&raquo;/g, "»")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** HTML -> texto plano en una línea (sin etiquetas, entidades resueltas). */
function inline(html) {
  return decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function dropBlocks(html) {
  let out = html;
  for (const tag of DROP_BLOCKS) {
    out = out.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi"), " ");
    out = out.replace(new RegExp(`<${tag}\\b[^>]*\\/>`, "gi"), " ");
  }
  return out.replace(/<img\b[^>]*>/gi, " ");
}

function toMarkdown(html) {
  let md = dropBlocks(html);

  // Enlaces -> [texto](url) en una sola línea.
  md = md.replace(/<a\b[^>]*\bhref="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, inner) => {
    const text = inline(inner);
    return text ? `[${text}](${href})` : "";
  });

  md = md
    .replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, t) => `**${inline(t)}**`)
    .replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, t) => `_${inline(t)}_`)
    .replace(/<h([2-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_, n, t) => `\n\n${"#".repeat(Number(n))} ${inline(t)}\n\n`)
    .replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_, t) => `\n- ${inline(t)}`)
    .replace(/<\/(p|div|ul|ol|section|article|tr|h[1-6])>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n");

  md = decodeEntities(md.replace(/<[^>]+>/g, " "));

  return md
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Enlaces externos citados (RRSS, prensa, ORCID, Scholar...). */
function externalLinks(mainHtml) {
  const seen = new Map();
  const re = /<a\b[^>]*\bhref="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(mainHtml))) {
    const href = m[1];
    if (href.includes(SITE_HOST)) continue;
    // En las "tarjetas" el título y la descripción van en elementos
    // hijos: el trozo más corto suele ser el título ("LinkedIn", "ORCID").
    const chunks = [...m[2].matchAll(/<(span|h[2-6]|strong|b|p)\b[^>]*>([\s\S]*?)<\/\1>/gi)]
      .map((x) => inline(x[2]))
      .filter((t) => t.length > 1);
    const label = (chunks.sort((a, b) => a.length - b.length)[0] || inline(m[2]))
      .split(". ")[0]
      .slice(0, 90);
    if (!seen.has(href)) seen.set(href, label);
  }
  return [...seen].map(([href, label]) => (label ? `- [${label}](${href})` : `- <${href}>`));
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (name.endsWith(".html")) out.push(full);
  }
  return out;
}

function routeFor(file) {
  let rel = relative(DIST, file).replace(/\\/g, "/");
  rel = rel.replace(/index\.html$/, "").replace(/\.html$/, "").replace(/\/$/, "");
  const urlPath = rel === "" ? "/" : `/${rel}/`;
  const key = `site/${rel === "" ? "home" : rel}.md`;
  return { key, url: SITE + urlPath };
}

function cleanTitle(raw) {
  return (
    (raw || "")
      .replace(/\s*[-–|·]\s*Víctor Cazorla Fern[aá]ndez\s*$/i, "")
      .replace(/\s+/g, " ")
      .trim() || "Víctor Cazorla Fernández"
  );
}

function yaml(v) {
  return `"${String(v).replace(/"/g, '\\"')}"`;
}

function attr(tag, name) {
  const m = tag.match(new RegExp(`\\b${name}="([^"]*)"`, "i"));
  return m ? m[1] : "";
}

function extractPage(file) {
  const html = readFileSync(file, "utf8");

  const htmlTag = html.match(/<html\b[^>]*>/i)?.[0] || "";
  const lang = (attr(htmlTag, "lang") || "es").slice(0, 2);
  const title = cleanTitle(html.match(/<title>([^<]*)<\/title>/i)?.[1]);
  const metaTag = html.match(/<meta\b[^>]*name="description"[^>]*>/i)?.[0] || "";
  const description = decodeEntities(attr(metaTag, "content")).trim();

  const mainHtml =
    html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ||
    html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ||
    "";
  if (!mainHtml) return null;

  const links = externalLinks(mainHtml);
  let md = toMarkdown(mainHtml);
  if (md.length < 80) return null;

  if (links.length) {
    md += `\n\n## Enlaces externos citados en esta página\n\n${links.join("\n")}`;
  }

  const { key, url } = routeFor(file);
  const front = [
    "---",
    `title: ${yaml(title)}`,
    `url: ${yaml(url)}`,
    `lang: ${yaml(lang)}`,
    `source: ${yaml("Sitio web oficial de Víctor Cazorla Fernández (victorcazorla.com)")}`,
    `updated: ${yaml(new Date().toISOString().slice(0, 10))}`,
    "---",
    "",
  ].join("\n");

  const body = `# ${title}\n\n${description ? `> ${description}\n\n` : ""}${md}\n`;
  return { key, content: front + body };
}

/** llms.txt ya es un resumen curado del perfil: lo incluimos tal cual. */
function extractLlms() {
  try {
    const txt = readFileSync(join(DIST, "llms.txt"), "utf8").trim();
    const front = [
      "---",
      `title: ${yaml("Perfil de Víctor Cazorla Fernández — resumen")}`,
      `url: ${yaml(SITE + "/llms.txt")}`,
      `lang: ${yaml("es")}`,
      `source: ${yaml("Resumen oficial del perfil (llms.txt de victorcazorla.com)")}`,
      `updated: ${yaml(new Date().toISOString().slice(0, 10))}`,
      "---",
      "",
    ].join("\n");
    return { key: "site/perfil-resumen.md", content: front + txt + "\n" };
  } catch {
    return null;
  }
}

function write(key, content) {
  const dest = join(OUT, key);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, content, "utf8");
}

function main() {
  if (!statSync(DIST, { throwIfNoEntry: false })?.isDirectory()) {
    console.error("No existe dist/. Ejecuta primero: npm run build");
    process.exit(1);
  }
  rmSync(join(OUT, "site"), { recursive: true, force: true });

  let n = 0;
  for (const file of walk(DIST).filter((f) => !SKIP.has(relative(DIST, f)))) {
    const page = extractPage(file);
    if (!page) continue;
    write(page.key, page.content);
    n++;
    console.log(`  ✓ ${page.key}`);
  }

  const llms = extractLlms();
  if (llms) {
    write(llms.key, llms.content);
    n++;
    console.log(`  ✓ ${llms.key}`);
  }

  console.log(`\n${n} documentos escritos en .kb/site/`);
  console.log("Añade material externo (prensa, RRSS) en kb/curated/*.md y luego: npm run kb:bundle");
}

main();
