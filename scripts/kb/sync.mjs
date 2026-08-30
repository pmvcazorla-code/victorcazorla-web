#!/usr/bin/env node
// Sube la base de conocimiento a un bucket de R2 que Cloudflare AI Search
// (AutoRAG) tiene configurado como origen de datos. AI Search reindexa solo
// cuando detecta cambios en el bucket.
//
// Fuentes que se suben:
//   .kb/site/**.md      -> site/**.md        (generado por kb:extract)
//   kb/curated/**.md     -> curated/**.md     (prensa, RRSS, notas manuales)
//
// Uso:
//   npm run kb:sync                 # sube cambios y borra lo que ya no existe
//   npm run kb:sync -- --dry-run    # solo muestra qué haría
//   npm run kb:sync -- --no-prune   # no borra nada del bucket
//
// Requisitos de entorno (wrangler):
//   CLOUDFLARE_API_TOKEN   token con permiso "Workers R2 Storage: Edit"
//   CLOUDFLARE_ACCOUNT_ID  id de la cuenta
//   o bien haber hecho `npx wrangler login`.
//
// Config (con valores por defecto):
//   KB_BUCKET   nombre del bucket R2   (por defecto: victorcazorla-kb)

import { readdirSync, statSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const REPO = fileURLToPath(new URL('../../', import.meta.url));
const BUCKET = process.env.KB_BUCKET || 'victorcazorla-kb';
const MANIFEST_KEY = '_kb-manifest.json';
const CONCURRENCY = 6;

const DRY = process.argv.includes('--dry-run');
const PRUNE = !process.argv.includes('--no-prune');

/** Lista recursiva de *.md bajo dir; devuelve rutas absolutas. */
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
    else if (name.endsWith('.md')) out.push(full);
  }
  return out;
}

/** { key -> rutaAbsoluta } con todas las fuentes combinadas. */
function collect() {
  const map = new Map();
  for (const f of mdFiles(join(REPO, '.kb', 'site'))) {
    map.set(`site/${relative(join(REPO, '.kb', 'site'), f).replace(/\\/g, '/')}`, f);
  }
  for (const f of mdFiles(join(REPO, 'kb', 'curated'))) {
    const rel = relative(join(REPO, 'kb', 'curated'), f).replace(/\\/g, '/');
    // Se ignoran README y los archivos que empiezan por "_" (plantillas).
    if (rel.toLowerCase() === 'readme.md' || rel.split('/').pop().startsWith('_')) continue;
    map.set(`curated/${rel}`, f);
  }
  return map;
}

async function wrangler(args) {
  return run('npx', ['--yes', 'wrangler', ...args], { cwd: REPO, maxBuffer: 64 * 1024 * 1024 });
}

async function putObject(key, file) {
  if (DRY) return console.log(`  put    ${key}`);
  await wrangler([
    'r2', 'object', 'put', `${BUCKET}/${key}`,
    '--file', file, '--content-type', 'text/markdown; charset=utf-8', '--remote',
  ]);
  console.log(`  ✓ put   ${key}`);
}

async function deleteObject(key) {
  if (DRY) return console.log(`  delete ${key}`);
  await wrangler(['r2', 'object', 'delete', `${BUCKET}/${key}`, '--remote']);
  console.log(`  ✓ del   ${key}`);
}

async function readManifest() {
  const tmp = join(mkdtempSync(join(tmpdir(), 'kb-')), 'm.json');
  try {
    await wrangler(['r2', 'object', 'get', `${BUCKET}/${MANIFEST_KEY}`, '--file', tmp, '--remote']);
    return new Set(JSON.parse(readFileSync(tmp, 'utf8')).keys || []);
  } catch {
    return new Set(); // primera ejecución o sin manifiesto
  }
}

async function writeManifest(keys) {
  if (DRY) return;
  const tmp = join(mkdtempSync(join(tmpdir(), 'kb-')), 'm.json');
  writeFileSync(tmp, JSON.stringify({ keys: [...keys].sort(), updated: new Date().toISOString() }, null, 2));
  await wrangler([
    'r2', 'object', 'put', `${BUCKET}/${MANIFEST_KEY}`,
    '--file', tmp, '--content-type', 'application/json', '--remote',
  ]);
}

/** Ejecuta tasks (funciones que devuelven promesa) con concurrencia limitada. */
async function pool(items, worker, limit) {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) await worker(queue.shift());
  });
  await Promise.all(runners);
}

async function main() {
  const current = collect();
  if (current.size === 0) {
    console.error('No hay nada en .kb/site/ ni kb/curated/. Ejecuta antes: npm run kb:extract');
    process.exit(1);
  }
  console.log(`Bucket: ${BUCKET}${DRY ? '  (dry-run)' : ''}`);
  console.log(`Documentos locales: ${current.size}\n`);

  const previous = PRUNE ? await readManifest() : new Set();

  console.log('Subiendo:');
  await pool([...current.entries()], ([key, file]) => putObject(key, file), CONCURRENCY);

  const currentKeys = new Set(current.keys());
  if (PRUNE) {
    const stale = [...previous].filter((k) => !currentKeys.has(k) && k !== MANIFEST_KEY);
    if (stale.length) {
      console.log('\nBorrando obsoletos:');
      await pool(stale, deleteObject, CONCURRENCY);
    }
  }

  await writeManifest(currentKeys);
  console.log(`\nListo. AI Search reindexará el bucket en unos minutos (o fuérzalo desde el panel).`);
}

main().catch((err) => {
  console.error('\nError de sincronización:', err.stderr || err.message || err);
  process.exit(1);
});
