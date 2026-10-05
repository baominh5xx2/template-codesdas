export function POST(): Response {
  return Response.json({ error: { code: "feature_unavailable", message: "Run execution is not configured in the starter.", retryable: false, traceId: "runs" } }, { status: 501 });
}
