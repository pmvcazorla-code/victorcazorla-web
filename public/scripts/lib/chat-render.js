/**
 * Renderizador mínimo y seguro de la respuesta del chatbot. La respuesta
 * del modelo puede traer Markdown ligero; en vez de meter una librería de
 * Markdown (y su superficie de XSS), se escapa TODO el HTML y luego se
 * rehidrata solo un subconjunto controlado: párrafos, saltos de línea,
 * **negrita**, viñetas y enlaces (Markdown `[texto](url)` y URLs sueltas),
 * siempre con http(s) y `rel="noopener"`.
 */

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeUrl(raw) {
  try {
    const u = new URL(raw, "https://victorcazorla.com");
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
}

function linkify(escapedText) {
  // Markdown [texto](url) — el texto y la url ya vienen escapados.
  let out = escapedText.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (m, text, url) => {
    const href = safeUrl(url.replace(/&amp;/g, "&"));
    return href ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${text}</a>` : m;
  });
  // URLs sueltas que no formaban parte de un enlace Markdown.
  out = out.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)(?![^<]*<\/a>)/g, (m, pre, url) => {
    const href = safeUrl(url.replace(/&amp;/g, "&"));
    if (!href) return m;
    return `${pre}<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(
      href
    )}</a>`;
  });
  return out;
}

function inline(text) {
  const escaped = escapeHtml(text);
  const bolded = escaped.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  return linkify(bolded);
}

/** Devuelve una cadena HTML segura lista para asignar a innerHTML. */
export function renderAnswer(raw) {
  const text = String(raw || "").replace(/\r\n/g, "\n").trim();
  if (!text) return "";

  const blocks = text.split(/\n{2,}/);
  const html = blocks
    .map((block) => {
      const lines = block.split("\n");
      const isList = lines.every((l) => /^\s*[-*]\s+/.test(l));
      if (isList) {
        const items = lines.map((l) => `<li>${inline(l.replace(/^\s*[-*]\s+/, ""))}</li>`).join("");
        return `<ul>${items}</ul>`;
      }
      return `<p>${lines.map(inline).join("<br>")}</p>`;
    })
    .join("");
  return html;
}
