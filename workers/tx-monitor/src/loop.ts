// ── Monitor Loop: execution store를 polling하여 상태 추적 ──

import type { ReceiptStatus } from "@slotflow/shared";
import { TERMINAL_STATUSES } from "@slotflow/shared";
import { pollOnce, type StatusPoller, type MonitorEvent, type MonitorableExecution } from "./monitor.js";

export interface MonitorLoopDeps {
  /** 비-terminal execution 목록 조회 */
  getActiveExecutions: () => MonitorableExecution[];
  /** 상태 변경 시 호출 */
  onTransition: (event: MonitorEvent) => void;
  /** RPC status poller */
  poller: StatusPoller;
  /** poll 간격 (ms) */
  intervalMs: number;
}

/**
 * Monitor loop를 시작한다.
 * 반환값은 stop 함수.
 */
export function startMonitorLoop(deps: MonitorLoopDeps): () => void {
  let active = true;
  const { getActiveExecutions, onTransition, poller, intervalMs } = deps;

  const tick = async () => {
    const executions = getActiveExecutions();
    const results = await Promise.allSettled(
      executions.map((exec) => pollOnce(exec, poller)),
    );

    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        onTransition(result.value);
      }
    }
  };

  const run = async () => {
    while (active) {
      try {
        await tick();
      } catch {
        // loop must not die on individual tick failure
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  };

  run();
  return () => { active = false; };
}

/**
 * In-memory execution registry.
 * store와 연동하여 monitor가 추적할 execution을 관리한다.
 */
export class ExecutionRegistry {
  private executions = new Map<string, MonitorableExecution>();

  register(exec: MonitorableExecution): void {
    this.executions.set(exec.receiptId, exec);
  }

  getActive(): MonitorableExecution[] {
    return [...this.executions.values()].filter(
      (e) => !TERMINAL_STATUSES.has(e.currentStatus),
    );
  }

  updateStatus(receiptId: string, status: ReceiptStatus): void {
    const exec = this.executions.get(receiptId);
    if (exec) exec.currentStatus = status;
  }

  remove(receiptId: string): void {
    this.executions.delete(receiptId);
  }
}
