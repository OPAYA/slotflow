// ── Store: state-machine-enforced receipt persistence ──

import type {
  SlotFlowReceipt,
  ReceiptStatus,
  ReceiptEvent,
  AttemptSummary,
} from "@slotflow/shared";
import { SlotFlowError } from "@slotflow/shared";
import { canTransition, isTerminal } from "@slotflow/tx-monitor";

export interface ExecutionStore {
  save(receipt: SlotFlowReceipt): void;
  get(receiptId: string): SlotFlowReceipt | undefined;
  list(filter?: ListFilter): SlotFlowReceipt[];
  updateStatus(receiptId: string, status: ReceiptStatus, event: ReceiptEvent): void;
  addAttempt(receiptId: string, attempt: AttemptSummary): void;
}

export interface ListFilter {
  policy?: string;
  status?: string;
  appId?: string;
  actionGroup?: string;
  limit?: number;
}

export function createMemoryStore(): ExecutionStore {
  const receipts = new Map<string, SlotFlowReceipt>();

  return {
    save(receipt) {
      receipts.set(receipt.receiptId, structuredClone(receipt));
    },

    get(receiptId) {
      const r = receipts.get(receiptId);
      return r ? structuredClone(r) : undefined;
    },

    list(filter) {
      let result = [...receipts.values()];

      if (filter?.policy) result = result.filter((r) => r.policy === filter.policy);
      if (filter?.status) result = result.filter((r) => r.status === filter.status);
      if (filter?.appId) result = result.filter((r) => r.appId === filter.appId);
      if (filter?.actionGroup) {
        result = result.filter((r) =>
          r.events.some((e) => e.detail?.actionGroup === filter.actionGroup),
        );
      }

      result.sort((a, b) => b.timestamps.createdAt.localeCompare(a.timestamps.createdAt));
      if (filter?.limit) result = result.slice(0, filter.limit);
      return result;
    },

    updateStatus(receiptId, status, event) {
      const receipt = receipts.get(receiptId);
      if (!receipt) {
        throw new SlotFlowError("RECEIPT_NOT_FOUND", `Receipt ${receiptId} not found`);
      }

      // state machine enforcement
      if (!canTransition(receipt.status, status)) {
        throw new SlotFlowError(
          "INVALID_TRANSITION",
          `Cannot transition ${receipt.status} → ${status}`,
        );
      }

      receipt.status = status;
      receipt.events.push(event);

      const now = event.at;
      if (status === "submitted") receipt.timestamps.submittedAt = now;
      if (status === "processed") receipt.timestamps.landedAt = now;
      if (status === "confirmed") receipt.timestamps.confirmedAt = now;
      if (status === "finalized") receipt.timestamps.finalizedAt = now;
      if (status === "expired") receipt.timestamps.expiredAt = now;

      if (isTerminal(status)) {
        receipt.terminalReason = event.reason;
      }
    },

    addAttempt(receiptId, attempt) {
      const receipt = receipts.get(receiptId);
      if (!receipt) {
        throw new SlotFlowError("RECEIPT_NOT_FOUND", `Receipt ${receiptId} not found`);
      }
      receipt.attempts.push(attempt);
    },
  };
}
