// ── Receipt: 실행 결과의 설명 가능한 영수증 ──

import type { ConfirmationTarget, SlotFlowPolicy } from "./policy.js";
import type { RouteKind } from "./route.js";

export const RECEIPT_STATUSES = [
  "accepted",
  "planned",
  "submitted",
  "relayed",
  "processed",
  "confirmed",
  "finalized",
  "expired",
  "failed",
] as const;
export type ReceiptStatus = (typeof RECEIPT_STATUSES)[number];

export const TERMINAL_STATUSES: ReadonlySet<ReceiptStatus> = new Set([
  "finalized",
  "expired",
  "failed",
]);

/** 상태 전이 이벤트 */
export interface ReceiptEvent {
  id: string;
  status: ReceiptStatus;
  at: string;
  reason?: string;
  detail?: Record<string, unknown>;
}

/** 개별 전송 시도 */
export interface AttemptSummary {
  id: string;
  routeKind: RouteKind;
  routeId: string;
  startedAt: string;
  endedAt?: string;
  result: "submitted" | "rejected" | "observed" | "failed";
  reason?: string;
}

/** route 설명 */
export interface RouteExplanation {
  title: string;
  bullets: string[];
}

/** fee 요약 */
export interface FeeSummary {
  estimatedAdditionalLamports: number;
  actualAdditionalLamports?: number;
  computeUnitLimit?: number;
  computeUnitPriceMicroLamports?: number;
  capApplied: boolean;
}

/** quality heuristic */
export interface QualityEstimate {
  score: number; // 0-100
  label: "latency-optimized" | "protection-enhanced" | "reliability-focused";
  signals: string[];
}

export interface PreflightResult {
  mode: "on" | "off" | "adaptive";
  passed?: boolean;
  error?: string;
}

export interface ReceiptTimestamps {
  createdAt: string;
  submittedAt?: string;
  landedAt?: string;
  confirmedAt?: string;
  finalizedAt?: string;
  expiredAt?: string;
}

/** 사용자-facing 실행 영수증 — SlotFlow의 핵심 산출물 */
export interface SlotFlowReceipt {
  receiptId: string;
  traceId: string;
  appId?: string;
  signature?: string;
  policy: SlotFlowPolicy;
  routeKind?: RouteKind;
  routeId?: string;
  status: ReceiptStatus;
  confirmationTarget: ConfirmationTarget;
  qualityEstimate: QualityEstimate;
  fee: FeeSummary;
  attempts: AttemptSummary[];
  events: ReceiptEvent[];
  explanation: RouteExplanation;
  preflight?: PreflightResult;
  timestamps: ReceiptTimestamps;
  terminalReason?: string;
}
