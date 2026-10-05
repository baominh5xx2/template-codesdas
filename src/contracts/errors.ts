export interface ErrorEnvelope {
  code: "internal_error";
  message: string;
  retryable: boolean;
  traceId: string;
}

export function toPublicError(_error: unknown, traceId: string): ErrorEnvelope {
  return {
    code: "internal_error",
    message: "Không thể hoàn tất thao tác.",
    retryable: false,
    traceId,
  };
}
