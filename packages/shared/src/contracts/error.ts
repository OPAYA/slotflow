// ── Error: 일관된 도메인 에러 모델 ──

export const ERROR_CODES = [
  "INVALID_REQUEST",
  "UNSUPPORTED_POLICY",
  "FEE_CAP_EXCEEDED",
  "NO_HEALTHY_ROUTE",
  "ADAPTER_SEND_FAILED",
  "RECEIPT_NOT_FOUND",
  "INVALID_TRANSITION",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

/** 도메인 에러 — 모든 SlotFlow 예외의 단일 타입 */
export class SlotFlowError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly retryable: boolean = false,
    public readonly detail?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "SlotFlowError";
  }
}

export interface ApiErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    retryable?: boolean;
    detail?: Record<string, unknown>;
  };
}
