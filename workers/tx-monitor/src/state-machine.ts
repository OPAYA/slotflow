// ── State Machine: receipt 상태 전이의 단일 진실 ──

import type { ReceiptStatus } from "@slotflow/shared";
import { TERMINAL_STATUSES } from "@slotflow/shared";

/**
 * 허용되는 상태 전이 맵.
 * 각 상태에서 갈 수 있는 다음 상태 목록을 정의한다.
 */
const TRANSITIONS: Record<ReceiptStatus, readonly ReceiptStatus[]> = {
  accepted:  ["planned", "failed"],
  planned:   ["submitted", "failed"],
  submitted: ["relayed", "processed", "confirmed", "failed", "expired"],
  relayed:   ["processed", "confirmed", "failed", "expired"],
  processed: ["confirmed", "failed", "expired"],
  confirmed: ["finalized"],
  // terminal states — 전이 없음
  finalized: [],
  expired:   [],
  failed:    [],
};

export interface TransitionResult {
  ok: boolean;
  from: ReceiptStatus;
  to: ReceiptStatus;
  reason?: string;
}

/**
 * 상태 전이가 유효한지 검증한다.
 * terminal 상태 이후 추가 전이는 차단.
 */
export function canTransition(from: ReceiptStatus, to: ReceiptStatus): boolean {
  if (TERMINAL_STATUSES.has(from)) return false;
  const allowed = TRANSITIONS[from];
  return allowed.includes(to);
}

/**
 * 상태 전이를 시도하고 결과를 반환한다.
 */
export function transition(from: ReceiptStatus, to: ReceiptStatus): TransitionResult {
  if (TERMINAL_STATUSES.has(from)) {
    return {
      ok: false,
      from,
      to,
      reason: `Cannot transition from terminal state '${from}'`,
    };
  }

  if (!canTransition(from, to)) {
    return {
      ok: false,
      from,
      to,
      reason: `Transition '${from}' → '${to}' is not allowed`,
    };
  }

  return { ok: true, from, to };
}

/**
 * 주어진 상태가 terminal인지 확인한다.
 */
export function isTerminal(status: ReceiptStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

/**
 * 정책별 terminal reason 분류.
 */
export type TerminalReason =
  | "blockhash_expired"
  | "preflight_failed"
  | "adapter_unhealthy"
  | "retry_exhausted"
  | "chain_error"
  | "confirmed_final"
  | "finalized";

export function classifyTerminalReason(
  status: ReceiptStatus,
  detail?: string,
): TerminalReason | undefined {
  switch (status) {
    case "finalized":
      return "finalized";
    case "expired":
      return detail === "retry_exhausted" ? "retry_exhausted" : "blockhash_expired";
    case "failed":
      if (detail?.includes("preflight")) return "preflight_failed";
      if (detail?.includes("adapter")) return "adapter_unhealthy";
      return "chain_error";
    default:
      return undefined;
  }
}
