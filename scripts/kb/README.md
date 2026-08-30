# Base de conocimiento del chatbot de `/inicio`

Pipeline que alimenta el chatbot de IA con contenido acotado al perfil de
Víctor Cazorla Fernández: las páginas del propio sitio + material curado
(prensa, RRSS, notas).

```
astro build  ─►  dist/**.html
                     │  scripts/kb/extract.mjs   (kb:extract)
                     ▼
                 .kb/site/**.md   +   kb/curated/**.md
                     │  scripts/kb/sync.mjs      (kb:sync)
                     ▼
        R2: victorcazorla-kb   ─►  AI Search (AutoRAG)  ─►  Pages Function /api/chat
                                        │
                                   AI Gateway (logs de preguntas en el panel)
```

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run kb:extract` | Lee `dist/` y genera `.kb/site/*.md` (contenido principal de cada página en Markdown, con frontmatter y enlaces externos citados). No usa red. |
| `npm run kb:sync` | Sube `.kb/site/**` y `kb/curated/**` al bucket R2. Borra del bucket lo que ya no existe (`--no-prune` lo evita, `--dry-run` solo lista). |
| `npm run kb:deploy` | `build` + `kb:extract` + `kb:sync` en cadena. |

`.kb/` está en `.gitignore` (es generado). `kb/curated/` **sí** se versiona.

## Puesta en marcha (una sola vez)

Todo en la misma cuenta de Cloudflare del proyecto Pages.

### 1. Bucket R2

```sh
npx wrangler r2 bucket create victorcazorla-kb
```

### 2. AI Gateway con logs

Panel → **AI** → **AI Gateway** → *Create Gateway*, nombre `victorcazorla-ai`.
En **Settings** del gateway, activa **Logs** (guarda peticiones y respuestas).
Ahí es donde podrás revisar las preguntas de los visitantes.

### 3. Instancia de AI Search

Panel → **AI** → **AI Search** → *Create*:

- **Data source**: bucket R2 `victorcazorla-kb`.
- **Embedding model**: `@cf/baai/bge-m3` (multilingüe: es/en/fr/ca).
- **Generation model**: `@cf/meta/llama-3.1-8b-instruct` (gratis en el tier de
  Workers AI). Alternativas sin coste de licencia: `@cf/meta/llama-3.3-70b-instruct-fp8-fast`
  o `@cf/deepseek-ai/deepseek-r1-distill-qwen-32b`. Se puede cambiar luego en Settings.
- **AI Gateway**: selecciona `victorcazorla-ai` para que todas las consultas
  queden registradas.
- **Nombre de la instancia**: `victorcazorla-ai-search`.
- **System prompt**: ver `scripts/kb/system-prompt.md`.

### 4. Credenciales para `kb:sync` en local

```sh
export CLOUDFLARE_ACCOUNT_ID="<id de cuenta>"
export CLOUDFLARE_API_TOKEN="<token con 'Workers R2 Storage: Edit'>"
# o simplemente:  npx wrangler login
```

### 5. Primera carga

```sh
npm run kb:deploy
```

Luego, en AI Search → **Data** → *Sync index* (o espera al reindexado
automático). Prueba una consulta desde la pestaña **Playground**.

## Mantenimiento

- **Cambias contenido del sitio**: `npm run kb:deploy` tras el deploy normal
  (o añade el paso al pipeline de Pages).
- **Nueva entrevista / mención en prensa / hito profesional**: crea un `.md`
  en `kb/curated/` (copia `_plantilla.md`), `git commit`, y `npm run kb:sync`.
- **Revisar qué preguntan los visitantes**: AI Gateway → `victorcazorla-ai` → Logs.

## Endpoint y widget (ya implementados)

- `functions/api/chat.ts` — Pages Function. Consulta
  `env.AI.autorag(AI_SEARCH_INSTANCE).aiSearch({ query, rewrite_query: true })`
  (vía compatible con el `compatibility_date` actual). Rate-limit por IP
  sobre el KV `CONTACT_RATE_LIMIT` (15/h, 50/día) y hCaptcha en el primer
  mensaje por IP (pase en KV, TTL 2 h). Lógica pura y testeada en
  `functions/_lib/chat.ts`.
- `src/components/ChatWidget.astro` + `public/scripts/chat-widget.js` —
  chat flotante, solo en `/` (la home española). hCaptcha invisible, se
  resuelve solo si el servidor responde `captcha_required`.
- Bindings/vars en `wrangler.jsonc`: `ai` (binding `AI`) y
  `AI_SEARCH_INSTANCE`. El secreto `HCAPTCHA_SECRET` ya existe (formulario
  de contacto); el chatbot lo reutiliza.
- Guardarraíles del modelo: `scripts/kb/system-prompt.md` (se pega en la
  config de la instancia de AI Search, no en el código).

Los guardarraíles y el nombre de la instancia son lo único que falta
configurar en el panel para que el chat funcione en producción.
