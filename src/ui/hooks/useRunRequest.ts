"use client";

import { useCallback, useState } from "react";

export type RunRequestState =
  | { phase: "idle" }
  | { phase: "submitting" }
  | { phase: "unavailable"; code: string; message: string }
  | { phase: "accepted"; runId: string }
  | { phase: "error"; message: string };

/**
 * Submits template input to the generic run BFF (`POST /api/runs`). While the platform runner is
 * not configured the endpoint answers 501 `feature_unavailable`; the hook surfaces that honestly
 * instead of pretending a run started.
 */
export function useRunRequest(domainId: string) {
  const [state, setState] = useState<RunRequestState>({ phase: "idle" });
  const submit = useCallback(async (input: unknown) => {
    setState({ phase: "submitting" });
    try {
      const response = await fetch("/api/runs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ domainId, input }) });
      const body = await response.json().catch(() => null) as { id?: string; runId?: string; error?: { code?: string; message?: string } } | null;
      if (response.ok && (body?.runId || body?.id)) { setState({ phase: "accepted", runId: (body.runId ?? body.id)! }); return; }
      if (response.status === 501 || response.status === 503 || body?.error?.code === "feature_unavailable") {
        setState({ phase: "unavailable", code: body?.error?.code ?? "feature_unavailable", message: body?.error?.message ?? "Run execution is not configured." });
        return;
      }
      setState({ phase: "error", message: body?.error?.message ?? `Máy chủ trả về mã ${response.status}.` });
    } catch {
      setState({ phase: "error", message: "Không kết nối được tới máy chủ." });
    }
  }, [domainId]);
  const reset = useCallback(() => setState({ phase: "idle" }), []);
  return { state, submit, reset };
}
