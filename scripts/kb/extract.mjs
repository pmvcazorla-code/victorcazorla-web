#!/usr/bin/env node
// Extrae el contenido principal de cada página ya compilada en dist/ y lo
// convierte a Markdown limpio dentro de .kb/, que luego kb:bundle
// empaqueta para el chatbot. No toca la red: solo lee dist/ y escribe .kb/.
//
// Uso:  npm run build && npm run kb:extract
//
// La salida imita la estructura de URLs del sitio:
//   /                -> .kb/site/home.md
//   /en/ethics/      -> .kb/site/en/ethics.md
//   /formacion/      -> .kb/site/formacion.md
// Cada archivo lleva frontmatter YAML (title, url, lang, source, updated)
// que el modelo usa para citar la fuente en las respuestas.

import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'node-html-parser';
import TurndownService from 'turndown';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const DIST = join(REPO, 'dist');
const OUT = join(REPO, '.kb');
const SITE = 'https://victorcazorla.com';

// Páginas sin valor para el chatbot (errores, redirecciones).
const SKIP = new Set(['404.html']);

// Selectores que se eliminan del <main> antes de convertir: navegación,
// formularios, iconos, elementos ocultos y el selector de idioma.
const STRIP = [
  'script', 'style', 'noscript', 'svg', 'nav', 'footer', 'form',
  'button', 'template', 'img', 'h1', '[hidden]', '[aria-hidden="true"]',
  '.skip-link', '.visually-hidden', '.sr-only',
];

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '_',
});
turndown.remove(['script', 'style']);
// Las "tarjetas" de RRSS son un <a> que envuelve varios <h3>/<p>: sin esto
// Turndown genera un enlace con el texto partido en varias líneas.
turndown.addRule('flatLinks', {
  filter: (node) => node.nodeName === 'A' && node.getAttribute('href'),
  replacement: (content, node) => {
    const text = content.replace(/\s+/g, ' ').trim();
    const href = node.getAttribute('href');
    return text ? `[${text}](${href})` : '';
  },
});

const SITE_HOST = 'victorcazorla.com';

/** Enlaces externos citados en la página (RRSS, prensa, ORCID, Scholar...). */
function externalLinks(main) {
  const seen = new Map();
  for (const a of main.querySelectorAll('a[href]')) {
    const href = (a.getAttribute('href') || '').trim();
    if (!/^https?:\/\//i.test(href) || href.includes(SITE_HOST)) continue;
    a.querySelectorAll('svg,[aria-hidden="true"]').forEach((el) => el.remove());
    // En las "tarjetas" el título y la descripción van en elementos hermanos;
    // el trozo de texto más corto suele ser el título ("LinkedIn", "ORCID"...).
    const chunks = a
      .querySelectorAll('*')
      .map((el) => el.text.replace(/\s+/g, ' ').trim())
      .filter((t) => t.length > 1)
      .sort((x, y) => x.length - y.length);
    const label = (chunks[0] || a.text.replace(/\s+/g, ' ').trim()).split('. ')[0].slice(0, 90);
    if (!seen.has(href)) seen.set(href, label);
  }
  return [...seen].map(([href, label]) => (label ? `- [${label}](${href})` : `- <${href}>`));
}

/** Lista recursiva de *.html dentro de dist/. */
function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

/** dist/en/ethics/index.html -> { key: 'site/en/ethics.md', url: '.../en/ethics/' } */
function routeFor(file) {
  let rel = relative(DIST, file).replace(/\\/g, '/');
  rel = rel.replace(/index\.html$/, '').replace(/\.html$/, '');
  rel = rel.replace(/\/$/, '');
  const urlPath = rel === '' ? '/' : `/${rel}/`;
  const key = `site/${rel === '' ? 'home' : rel}.md`;
  return { key, url: SITE + urlPath };
}

function cleanTitle(raw) {
  return (raw || '')
    .replace(/\s*[-–|·]\s*Víctor Cazorla Fern[aá]ndez\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim() || 'Víctor Cazorla Fernández';
}

function yaml(v) {
  return `"${String(v).replace(/"/g, '\\"')}"`;
}

function extractPage(file) {
  const html = readFileSync(file, 'utf8');
  const root = parse(html, { comment: false });

  const lang = root.querySelector('html')?.getAttribute('lang')?.slice(0, 2) || 'es';
  const title = cleanTitle(root.querySelector('title')?.text);
  const description = root
    .querySelector('meta[name="description"]')
    ?.getAttribute('content')
    ?.trim();

  const main =
    root.querySelector('#main-content') || root.querySelector('main') || root.querySelector('body');
  if (!main) return null;

  const links = externalLinks(main);
  for (const sel of STRIP) main.querySelectorAll(sel).forEach((el) => el.remove());

  let md = turndown.turndown(main.innerHTML);
  md = md.replace(/\n{3,}/g, '\n\n').trim();
  if (md.length < 80) return null; // página vacía o solo chrome

  if (links.length) {
    md += `\n\n## Enlaces externos citados en esta página\n\n${links.join('\n')}`;
  }

  const { key, url } = routeFor(file);
  const front = [
    '---',
    `title: ${yaml(title)}`,
    `url: ${yaml(url)}`,
    `lang: ${yaml(lang)}`,
    `source: ${yaml('Sitio web oficial de Víctor Cazorla Fernández (victorcazorla.com)')}`,
    `updated: ${yaml(new Date().toISOString().slice(0, 10))}`,
    '---',
    '',
  ].join('\n');

  const body = `# ${title}\n\n${description ? `> ${description}\n\n` : ''}${md}\n`;
  return { key, content: front + body };
}

/** llms.txt ya es un resumen curado del perfil: lo incluimos tal cual. */
function extractLlms() {
  const p = join(DIST, 'llms.txt');
  try {
    const txt = readFileSync(p, 'utf8').trim();
    const front = [
      '---',
      `title: ${yaml('Perfil de Víctor Cazorla Fernández — resumen')}`,
      `url: ${yaml(SITE + '/llms.txt')}`,
      `lang: ${yaml('es')}`,
      `source: ${yaml('Resumen oficial del perfil (llms.txt de victorcazorla.com)')}`,
      `updated: ${yaml(new Date().toISOString().slice(0, 10))}`,
      '---',
      '',
    ].join('\n');
    return { key: 'site/perfil-resumen.md', content: front + txt + '\n' };
  } catch {
    return null;
  }
}

function write(key, content) {
  const dest = join(OUT, key);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, content, 'utf8');
}

function main() {
  if (!statSync(DIST, { throwIfNoEntry: false })?.isDirectory()) {
    console.error('No existe dist/. Ejecuta primero: npm run build');
    process.exit(1);
  }
  rmSync(join(OUT, 'site'), { recursive: true, force: true });

  const files = walk(DIST).filter((f) => !SKIP.has(relative(DIST, f)));
  let n = 0;
  for (const file of files) {
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
  console.log('Añade material externo (prensa, RRSS) en kb/curated/*.md y luego: npm run kb:bundle');
}

main();
