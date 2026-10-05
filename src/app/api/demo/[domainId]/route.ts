import { DemoStateSchema } from "@/demo/schemas";
import { assertDemoEnabled, DemoRequestError, getDemoBundle } from "@/demo/catalog";
import { FeatureUnavailableError } from "@/contracts/errors";

export async function GET(request: Request, context: { params: Promise<{ domainId: string }> }): Promise<Response> {
  try {
    assertDemoEnabled(process.env.NODE_ENV);
    const { domainId } = await context.params;
    const rawState = new URL(request.url).searchParams.get("state") ?? "success";
    const state = DemoStateSchema.safeParse(rawState);
    if (!state.success) throw new DemoRequestError("invalid_request", "Demo state is invalid.");
    return Response.json(getDemoBundle(domainId, state.data));
  } catch (error) {
    if (error instanceof FeatureUnavailableError) return Response.json({ error: { code: "feature_unavailable", message: error.message, retryable: false, traceId: "demo" } }, { status: 503 });
    if (error instanceof DemoRequestError) return Response.json({ error: { code: error.code, message: error.message, retryable: false, traceId: "demo" } }, { status: error.code === "not_found" ? 404 : 400 });
    return Response.json({ error: { code: "internal_error", message: "Unable to load demo fixture.", retryable: false, traceId: "demo" } }, { status: 500 });
  }
}
