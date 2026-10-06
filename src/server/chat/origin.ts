import "server-only";

/**
 * Origin the browser should send for a same-origin request, derived from the native Host header.
 * Next normalizes loopback Request.url to localhost; the native Host retains the request authority
 * and browser fetch cannot set this forbidden header. Forwarded headers are intentionally not trusted.
 */
export function incomingOrigin(request: Request, url: URL = new URL(request.url)): string | undefined {
  if (!["http:", "https:"].includes(url.protocol)) return;
  const authority = request.headers.get("host") ?? url.host;
  if (!authority || /[\s/@?#\%]/.test(authority)) return;
  try {
    const incoming = new URL(`${url.protocol}//${authority}`);
    if (!incoming.hostname || incoming.username || incoming.password || incoming.pathname !== "/" || incoming.search || incoming.hash) return;
    return incoming.origin;
  } catch { return; }
}
