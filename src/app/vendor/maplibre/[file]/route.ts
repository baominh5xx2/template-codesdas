import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Serves MapLibre's module worker from the installed package. Turbopack cannot resolve the worker's
 * `new URL(..., import.meta.url)`, so the client calls `setWorkerUrl("/vendor/maplibre/maplibre-gl-worker.mjs")`.
 * Only the two files the worker needs are allowed.
 */
const ALLOWED = new Set(["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]);
// Resolved from the project root: bundlers rewrite require.resolve paths in route handlers.
const dist = path.join(process.cwd(), "node_modules", "maplibre-gl", "dist");

export async function GET(_request: Request, context: { params: Promise<{ file: string }> }): Promise<Response> {
  const { file } = await context.params;
  if (!ALLOWED.has(file)) return new Response("Not found", { status: 404 });
  const body = await readFile(path.join(dist, file), "utf8");
  return new Response(body, { headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "public, max-age=86400" } });
}
