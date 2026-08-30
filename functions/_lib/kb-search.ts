/**
 * Búsqueda por solapamiento de términos sobre la base de conocimiento
 * empaquetada (functions/_lib/kb-content.json). Lógica pura, sin red:
 * el corpus es diminuto (~30 páginas) así que un ranking por palabras
 * clave con realce de título y de idioma es más que suficiente y no
 * gasta ninguna llamada de embeddings.
 */

export type KbDoc = {
  id: string;
  title: string;
  url: string | null;
  lang: string;
  source: string;
  text: string;
};

export type KbHit = { doc: KbDoc; score: number };

const STOPWORDS = new Set(
  (
    // es / en / fr / ca — palabras funcionales que no aportan señal
    "de la el los las un una unos unas y o u que en con por para su sus del al se lo le les es son ser sobre como mas más este esta esto estos estas " +
    // "it" NO va aquí a propósito: en este sitio "IT" es el área de tecnología.
    "the of to and in a is are was for on with as at by an be this that from or " +
    "de la le les des un une du au aux et ou que qui dans pour par sur avec est sont " +
    "el la els les un una i o que en amb per del al es son sobre"
  ).split(/\s+/)
);

/** minúsculas + sin acentos + solo letras/números/espacios */
export function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(input: string): string[] {
  return normalize(input)
    .split(" ")
    // >= 2 y no vacío: "it", "ia", "ux"... son siglas con señal en este
    // sitio; las funcionales de 2 letras ya están en STOPWORDS.
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

const LANG_HINTS: Record<string, string[]> = {
  es: ["que", "de", "en", "cual", "quien", "donde", "como", "por", "para", "es", "del"],
  en: ["what", "who", "where", "how", "the", "is", "does", "of", "about"],
  fr: ["que", "qui", "quel", "quelle", "ou", "comment", "est", "des", "pour"],
  ca: ["que", "qui", "quin", "quina", "on", "com", "es", "del", "amb", "per"],
};

/** Idioma probable de la consulta, para realzar los documentos en ese idioma. */
export function detectLang(query: string): string {
  const words = new Set(normalize(query).split(" "));
  let best = "es";
  let bestHits = 0;
  for (const [lang, hints] of Object.entries(LANG_HINTS)) {
    const hits = hints.reduce((n, w) => n + (words.has(w) ? 1 : 0), 0);
    if (hits > bestHits) {
      bestHits = hits;
      best = lang;
    }
  }
  return best;
}

/**
 * Devuelve los `k` documentos más relevantes (score > 0), ordenados de
 * mayor a menor. `perfil-resumen` no se fuerza aquí; el endpoint lo
 * añade siempre aparte.
 */
export function retrieve(query: string, docs: KbDoc[], k = 3): KbHit[] {
  const queryTokens = [...new Set(tokenize(query))];
  if (!queryTokens.length) return [];

  const queryLang = detectLang(query);

  const hits: KbHit[] = docs.map((doc) => {
    const haystack = normalize(`${doc.title} ${doc.text}`);
    const titleHay = normalize(doc.title);
    let score = 0;
    for (const token of queryTokens) {
      // Palabra completa (el texto normalizado es solo [a-z0-9 ]), para
      // que "it" no cuente dentro de "digital".
      const wordRe = new RegExp(`\\b${token}\\b`, "g");
      if ((titleHay.match(wordRe) || []).length > 0) score += 3;
      // Frecuencia con tope: evita que una página larga gane solo por tamaño.
      const occurrences = (haystack.match(wordRe) || []).length;
      if (occurrences > 0) score += Math.min(occurrences, 4);
    }
    if (score > 0 && doc.lang === queryLang) score *= 1.35;
    return { doc, score };
  });

  return hits
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
