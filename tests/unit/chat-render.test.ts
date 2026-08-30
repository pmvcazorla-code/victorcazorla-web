import { describe, expect, it } from "vitest";
import { renderAnswer, escapeHtml } from "../../public/scripts/lib/chat-render.js";

describe("escapeHtml", () => {
  it("neutraliza el HTML", () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"
    );
  });
});

describe("renderAnswer", () => {
  it("envuelve el texto en párrafos y respeta los saltos simples", () => {
    expect(renderAnswer("Hola.\nSegunda línea.\n\nOtro párrafo.")).toBe(
      "<p>Hola.<br>Segunda línea.</p><p>Otro párrafo.</p>"
    );
  });

  it("convierte **negrita** y listas con guion", () => {
    expect(renderAnswer("- uno\n- **dos**")).toBe("<ul><li>uno</li><li><strong>dos</strong></li></ul>");
  });

  it("convierte enlaces Markdown y URLs sueltas a <a> con rel seguro", () => {
    const html = renderAnswer("Ver [su web](https://victorcazorla.com/formacion/).");
    expect(html).toContain('<a href="https://victorcazorla.com/formacion/" target="_blank" rel="noopener noreferrer">su web</a>');

    const bare = renderAnswer("Fuente: https://victorcazorla.com/deontologia/");
    expect(bare).toContain('href="https://victorcazorla.com/deontologia/"');
  });

  it("no ejecuta HTML inyectado en la respuesta del modelo", () => {
    const html = renderAnswer('<script>alert(1)</script> texto **normal**');
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("<strong>normal</strong>");
  });

  it("no genera enlaces para esquemas que no sean http(s)", () => {
    const html = renderAnswer("[pulsa](javascript:alert(1))");
    expect(html).not.toContain("<a ");
    expect(html).toContain("[pulsa]");
  });

  it("devuelve cadena vacía para entrada vacía", () => {
    expect(renderAnswer("   ")).toBe("");
  });
});
