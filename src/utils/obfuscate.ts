/**
 * Ofusca una cadena como referencias de carácter HTML decimales
 * (&#099; en vez de "c"). Los navegadores las decodifican al renderizar,
 * pero un scraper que lea el HTML estático de la build no ve la
 * dirección en texto plano.
 */
export function toHtmlEntities(value: string): string {
  return Array.from(value)
    .map((char) => `&#${char.codePointAt(0)};`)
    .join("");
}
