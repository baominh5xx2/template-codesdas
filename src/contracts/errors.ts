export interface ErrorEnvelope {
  code: "internal_error" | "feature_unavailable" | "invalid_request" | "not_found";
  message: string;
  retryable: boolean;
  traceId: string;
}

export class FeatureUnavailableError extends Error {
  readonly code = "feature_unavailable";
  constructor(message = "This feature is not available in the starter skeleton.") { super(message); this.name = "FeatureUnavailableError"; }
}

export function toPublicError(error: unknown, traceId: string): ErrorEnvelope {
  if (error instanceof FeatureUnavailableError) return { code: error.code, message: error.message, retryable: false, traceId };
  return {
    code: "internal_error",
    message: "Không thể hoàn tất thao tác.",
    retryable: false,
    traceId,
  };
}
