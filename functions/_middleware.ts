import { resolveHostAction } from "./_lib/canonical-host";

// Subconjunto mínimo del contexto de Pages Functions: evita añadir
// @cloudflare/workers-types solo para tipar `next`. Mismo enfoque que
// functions/api/contact.ts.
interface MiddlewareContext {
  request: Request;
  next: () => Promise<Response>;
}

export async function onRequest(context: MiddlewareContext): Promise<Response> {
  const url = new URL(context.request.url);
  const action = resolveHostAction(url.hostname, url.pathname + url.search);

  if (action.type === "redirect") {
    return Response.redirect(action.location, 301);
  }

  const response = await context.next();

  if (action.type === "noindex") {
    // Los headers de una respuesta ya emitida son inmutables: se clonan.
    const headers = new Headers(response.headers);
    headers.set("X-Robots-Tag", "noindex, nofollow");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  return response;
}
