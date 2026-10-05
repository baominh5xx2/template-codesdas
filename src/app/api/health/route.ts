export function GET(): Response {
  return Response.json({ status: "ok", mode: "skeleton", version: "1.0.0" });
}
