// ── Tx Monitor: polling 기반 상태 추적 worker ──

import type { ConfirmationTarget, ReceiptStatus } from "@slotflow/shared";
import { transition, isTerminal, classifyTerminalReason } from "./state-machine.js";

export interface MonitorableExecution {
  receiptId: string;
  signature: string;
  currentStatus: ReceiptStatus;
  confirmationTarget: ConfirmationTarget;
  maxRetries: number;
  retryCount: number;
  createdAt: number; // epoch ms
}

export interface StatusPollResult {
  found: boolean;
  commitment?: "processed" | "confirmed" | "finalized";
  err?: string;
}

export interface MonitorEvent {
  receiptId: string;
  from: ReceiptStatus;
  to: ReceiptStatus;
  reason?: string;
  at: string;
}

export interface StatusPoller {
  poll(signature: string): Promise<StatusPollResult>;
}

const BLOCKHASH_TTL_MS = 90_000; // ~60 slots × 400ms, with margin

/**
 * 단일 execution에 대해 한 번의 poll 사이클을 실행한다.
 * 상태 변경이 있으면 MonitorEvent를 반환, 없으면 null.
 */
export async function pollOnce(
  exec: MonitorableExecution,
  poller: StatusPoller,
): Promise<MonitorEvent | null> {
  // 이미 terminal이면 skip
  if (isTerminal(exec.currentStatus)) return null;

  // blockhash 만료 체크
  const age = Date.now() - exec.createdAt;
  if (age > BLOCKHASH_TTL_MS && exec.currentStatus === "submitted") {
    if (exec.retryCount >= exec.maxRetries) {
      return tryTransition(exec, "expired", "blockhash_expired");
    }
    // retry 여지가 있으면 아직 expired 판정하지 않음
  }

  // RPC poll
  const result = await poller.poll(exec.signature);

  if (result.err) {
    return tryTransition(exec, "failed", result.err);
  }

  if (!result.found) {
    // 아직 관측 안 됨 — 상태 유지
    return null;
  }

  // commitment level에 따라 target 상태 결정
  const nextStatus = commitmentToStatus(result.commitment);
  if (!nextStatus || nextStatus === exec.currentStatus) return null;

  return tryTransition(exec, nextStatus);
}

function tryTransition(
  exec: MonitorableExecution,
  to: ReceiptStatus,
  reason?: string,
): MonitorEvent | null {
  const result = transition(exec.currentStatus, to);
  if (!result.ok) return null;

  const terminalReason = isTerminal(to) ? classifyTerminalReason(to, reason) : undefined;

  return {
    receiptId: exec.receiptId,
    from: exec.currentStatus,
    to,
    reason: terminalReason ?? reason,
    at: new Date().toISOString(),
  };
}

function commitmentToStatus(
  commitment?: "processed" | "confirmed" | "finalized",
): ReceiptStatus | null {
  switch (commitment) {
    case "processed":  return "processed";
    case "confirmed":  return "confirmed";
    case "finalized":  return "finalized";
    default:           return null;
  }
}
