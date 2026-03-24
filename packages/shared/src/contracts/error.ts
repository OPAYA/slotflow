// ── Error: 일관된 API 에러 모델 ──

export const ERROR_CODES = [
  "INVALID_REQUEST",
  "UNSUPPORTED_POLICY",
  "FEE_CAP_EXCEEDED",
  "NO_HEALTHY_ROUTE",
  "ADAPTER_SEND_FAILED",
  "RECEIPT_NOT_FOUND",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ApiError {
  error: {
    code: ErrorCode;
    message: string;
    retryable?: boolean;
    detail?: Record<string, unknown>;
  };
}
