# Base de conocimiento del chatbot de `/inicio`

Chatbot acotado al perfil de Víctor Cazorla Fernández. Responde con la
información del propio sitio + material curado (prensa, RRSS). **Sin coste
y sin servicios de pago**: la base de conocimiento viaja empaquetada
dentro del despliegue y la generación usa la cuota diaria gratuita de
Workers AI.

```
astro build ─► dist/**.html
                 │  scripts/kb/extract.mjs   (kb:extract)
                 ▼
             .kb/site/**.md   +   kb/curated/**.md
                 │  scripts/kb/bundle.mjs    (kb:bundle)
                 ▼
        functions/_lib/kb-content.json   (≈110 KB, versionado, se despliega con el sitio)
                 │
                 ▼
   functions/api/chat.ts  ──►  búsqueda por palabras clave (en memoria)
                 │             + Workers AI (env.AI.run, modelo gratuito)
                 ▼
         AI Gateway "victorcazorla-ai"  (Logs ON → preguntas visibles en el panel)
```

**Por qué así y no con AI Search / R2**: R2 obliga a activar una
suscripción de pago por uso (aunque tenga tramo gratuito) y AI Search
depende de R2. Se descartó para que **no exista ninguna vía de cobro**.
El corpus es diminuto (~30 páginas), así que un ranking por solapamiento
de términos + el resumen `llms.txt` siempre en contexto da resultados de
sobra sin necesidad de embeddings ni vector store.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run kb:extract` | `dist/**.html` → `.kb/site/*.md` (contenido principal a Markdown, con frontmatter y enlaces externos citados). Incluye `llms.txt` como resumen. Sin red. |
| `npm run kb:bundle` | `.kb/site/**` + `kb/curated/**` → `functions/_lib/kb-content.json`. Sin red. |
| `npm run kb:build` | `build` + `kb:extract` + `kb:bundle` en cadena. |

`.kb/` está en `.gitignore` (intermedio). `functions/_lib/kb-content.json`
y `kb/curated/` **sí** se versionan: el JSON es lo que se despliega.

## Recursos en Cloudflare

- **AI Gateway `victorcazorla-ai`** — creado, con *Collect Logs* activado.
  Aquí se revisan las preguntas de los visitantes:
  Panel → AI → AI Gateway → `victorcazorla-ai` → **Logs**.
- **Workers AI** — no necesita configuración: el binding `ai` de
  `wrangler.jsonc` funciona en el plan Workers Free. La cuota diaria
  gratuita (10.000 Neurons/día) se reparte entre todas las peticiones; si
  se agota, el endpoint devuelve un error controlado (nunca factura sin
  plan Workers Paid).
- **Modelo**: `@cf/meta/llama-3.1-8b-instruct-fast`, con
  `@cf/qwen/qwen3.8-27b` de reserva (vars `CHAT_MODEL` y
  `CHAT_MODEL_FALLBACK` en `wrangler.jsonc`). Cloudflare retira modelos
  antiguos devolviendo un 410; si el primario cae, el endpoint reintenta
  con el fallback. Modelos vivos: Panel → AI → Models (Text Generation,
  filtro "Cloudflare-hosted").
- **hCaptcha**: reutiliza `HCAPTCHA_SECRET` (ya configurado para el
  formulario de contacto).

## Puesta en marcha / actualización

```sh
npm run kb:build          # regenera functions/_lib/kb-content.json
git add functions/_lib/kb-content.json && git commit -m "content: actualiza KB del chatbot"
git push                  # el deploy de Pages recoge el binding ai y el JSON
```

Opcional: en Pages → Settings → Builds, poner el *Build command* como
`npm run kb:build` para que el JSON se regenere en cada despliegue sin
tener que commitearlo a mano.

## Mantenimiento

- **Cambia contenido del sitio** → `npm run kb:build` + commit del JSON.
- **Nueva entrevista / mención en prensa / hito** → crea un `.md` en
  `kb/curated/` (copia `_plantilla.md`), y `npm run kb:build` + commit.
- **Guardarraíles del modelo** → `functions/_lib/chat.ts` (constante
  `SYSTEM_PROMPT`). `system-prompt.md` de esta carpeta es la copia de
  referencia legible.
- **Revisar qué preguntan los visitantes** → AI Gateway → `victorcazorla-ai` → Logs.
