# Material curado para el chatbot

Cada archivo `.md` de esta carpeta se empaqueta en
`functions/_lib/kb-content.json` (bajo el prefijo `curated/`) y pasa a ser
consultable por el chatbot de `/inicio`.

Úsalo para lo que **no** está en las páginas del sitio y no se puede
rastrear de forma fiable (LinkedIn, prensa, entrevistas, notas de perfil,
FAQ):

- No copies textos con copyright completos; resume y enlaza a la fuente.
- Escribe en tercera persona y en el idioma del contenido original.
- Rellena siempre el frontmatter (`title`, `url`, `source`, `updated`).
- Un tema por archivo, con nombre descriptivo: `prensa-entrevista-coamb.md`.

Plantilla: copia `_plantilla.md` (los archivos que empiezan por `_` y este
README no se empaquetan).

Tras editar: `npm run kb:bundle` (o `npm run kb:build` para regenerar
también desde el sitio), y commitea `functions/_lib/kb-content.json`.
