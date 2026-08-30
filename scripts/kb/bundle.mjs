#!/usr/bin/env node
// Empaqueta la base de conocimiento (.kb/site/**.md, generada por
// kb:extract) en un único JSON que viaja DENTRO del despliegue de Pages:
// functions/_lib/kb-content.json. functions/api/chat.ts lo importa y hace
// la búsqueda en memoria — sin R2, sin AI Search, sin coste.
//
// Uso:  npm run build && npm run kb:extract && npm run kb:bundle
//   (o simplemente:  npm run kb:build)
//
// Al ser un corpus diminuto (~30 páginas, ~110 KB) no hace falta trocear
// ni vectorizar: se guarda el texto completo de cada página y el
// endpoint puntúa por solapamiento de términos.

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("../../", import.meta.url));
const SITE_DIR = join(REPO, ".kb", "site");
const CURATED_DIR = join(REPO, "kb", "curated");
const OUT = join(REPO, "functions", "_lib", "kb-content.json");

// Recorte por documento: el endpoint mete 3-4 documentos en el prompt de
// un modelo con ventana de 8k tokens, así que cada uno se limita.
const MAX_DOC_CHARS = 6000;

function mdFiles(dir) {
  let out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out = out.concat(mdFiles(full));
    else if (name.endsWith(".md") && !name.startsWith("_") && name.toLowerCase() !== "readme.md") {
      out.push(full);
    }
  }
  return out;
}

/** Separa el frontmatter YAML (plano, una clave por línea) del cuerpo. */
function parse(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: md.trim() };
  const meta = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([a-z_]+):\s*"?(.*?)"?\s*$/i);
    if (kv) meta[kv[1]] = kv[2];
  }
  return { meta, body: m[2].trim() };
}

function build() {
  const docs = [];
  for (const file of [...mdFiles(SITE_DIR), ...mdFiles(CURATED_DIR)]) {
    const { meta, body } = parse(readFileSync(file, "utf8"));
    const rel = relative(REPO, file).replace(/\\/g, "/");
    const id = rel
      .replace(/^\.kb\/site\//, "site/")
      .replace(/^kb\/curated\//, "curated/")
      .replace(/\.md$/, "");
    const text = body.length > MAX_DOC_CHARS ? `${body.slice(0, MAX_DOC_CHARS)}…` : body;
    docs.push({
      id,
      title: meta.title || id,
      url: meta.url || null,
      lang: meta.lang || "es",
      source: meta.source || "",
      text,
    });
  }

  // El resumen de perfil (llms.txt) va primero: el endpoint lo incluye
  // siempre como contexto base.
  docs.sort((a, b) => {
    if (a.id === "site/perfil-resumen") return -1;
    if (b.id === "site/perfil-resumen") return 1;
    return a.id.localeCompare(b.id);
  });

  if (!docs.length) {
    console.error("No hay documentos en .kb/site/. Ejecuta antes: npm run kb:extract");
    process.exit(1);
  }

  const payload = { generated: new Date().toISOString().slice(0, 10), docs };
  writeFileSync(OUT, JSON.stringify(payload), "utf8");
  const kb = (statSync(OUT).size / 1024).toFixed(0);
  console.log(`${docs.length} documentos -> functions/_lib/kb-content.json (${kb} KB)`);
}

build();
