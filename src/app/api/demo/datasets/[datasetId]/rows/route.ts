import { DatasetPageSchema } from "@/contracts/datasets";
import { DEMO_DATASETS } from "@/demo/data";
import { DemoRequestError, assertDemoEnabled } from "@/demo/catalog";
import { FeatureUnavailableError } from "@/contracts/errors";

export async function GET(request: Request, context: { params: Promise<{ datasetId: string }> }): Promise<Response> {
  try {
    assertDemoEnabled(process.env.NODE_ENV);
    const { datasetId } = await context.params;
    const params = new URL(request.url).searchParams;
    const offset = parsePagination(params.get("offset"), 0);
    const limit = parsePagination(params.get("limit"), 25);
    if (offset === null || limit === null || limit < 1 || limit > 100) throw new DemoRequestError("invalid_request", "Pagination must use offset >= 0 and limit from 1 to 100.");
    const page = DEMO_DATASETS[datasetId];
    if (!page) throw new DemoRequestError("not_found", "Demo dataset not found.");
    return Response.json(DatasetPageSchema.parse({ ...page, rows: page.rows.slice(offset, offset + limit), offset, limit }));
  } catch (error) {
    if (error instanceof FeatureUnavailableError) return Response.json({ error: { code: "feature_unavailable", message: error.message, retryable: false, traceId: "demo" } }, { status: 503 });
    if (error instanceof DemoRequestError) return Response.json({ error: { code: error.code, message: error.message, retryable: false, traceId: "demo" } }, { status: error.code === "not_found" ? 404 : 400 });
    return Response.json({ error: { code: "internal_error", message: "Unable to load demo rows.", retryable: false, traceId: "demo" } }, { status: 500 });
  }
}

function parsePagination(value: string | null, fallback: number): number | null {
  if (value === null) return fallback;
  if (!/^(0|[1-9]\d*)$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}
