// ── Execution Service: send 요청 → receipt 생성 orchestration ──

import { randomUUID } from "node:crypto";
import type {
  SlotFlowReceipt,
  SlotFlowSendRequest,
  RouteEstimate,
  RouteHealthSnapshot,
  QualityEstimate,
} from "@slotflow/shared";
import { deriveExecutionPlan } from "@slotflow/policy-engine";
import type { RouteAdapter } from "@slotflow/route-adapters";
import type { ExecutionStore } from "./store.js";

export interface ExecutionServiceDeps {
  store: ExecutionStore;
  adapters: RouteAdapter[];
}

export class ExecutionService {
  private store: ExecutionStore;
  private adapters: RouteAdapter[];

  constructor(deps: ExecutionServiceDeps) {
    this.store = deps.store;
    this.adapters = deps.adapters;
  }

  async execute(request: SlotFlowSendRequest): Promise<SlotFlowReceipt> {
    const { options } = request;
    const receiptId = `rcpt_${randomUUID().slice(0, 12)}`;
    const traceId = `trace_${randomUUID().slice(0, 12)}`;
    const now = new Date().toISOString();

    // 1. adapter health + estimate 수집
    const [healthSnapshots, estimates] = await this.gatherAdapterInfo();

    // 2. policy engine → execution plan
    const plan = deriveExecutionPlan({
      options,
      routeHealth: healthSnapshots,
      routeEstimates: estimates,
    });

    // 3. chosen adapter로 send
    const chosenAdapter = this.adapters.find((a) => a.id === plan.chosenRoute.routeId);
    if (!chosenAdapter) throw new Error("NO_HEALTHY_ROUTE");

    let signature: string | undefined;
    let sendResult: "submitted" | "failed" = "submitted";
    let sendError: string | undefined;

    try {
      const result = await chosenAdapter.send({
        signedTransaction: request.signedTransaction,
        computeUnitLimit: plan.feeStrategy.computeUnitLimit,
        computeUnitPriceMicroLamports: plan.feeStrategy.computeUnitPriceMicroLamports,
        preflightMode: plan.preflightMode,
      });
      signature = result.signature;
    } catch (err) {
      sendResult = "failed";
      sendError = err instanceof Error ? err.message : "Unknown send error";
    }

    // 4. quality estimate
    const qualityEstimate = deriveQuality(plan.policy, plan.chosenRoute.score, plan.feeStrategy.capApplied);

    // 5. receipt 생성
    const receipt: SlotFlowReceipt = {
      receiptId,
      traceId,
      signature,
      policy: plan.policy,
      routeKind: plan.chosenRoute.kind,
      routeId: plan.chosenRoute.routeId,
      status: sendResult,
      confirmationTarget: plan.confirmationTarget,
      qualityEstimate,
      fee: {
        estimatedAdditionalLamports: plan.feeStrategy.estimatedAdditionalLamports,
        computeUnitLimit: plan.feeStrategy.computeUnitLimit,
        computeUnitPriceMicroLamports: plan.feeStrategy.computeUnitPriceMicroLamports,
        capApplied: plan.feeStrategy.capApplied,
      },
      attempts: [
        {
          id: `att_${randomUUID().slice(0, 8)}`,
          routeKind: plan.chosenRoute.kind,
          routeId: plan.chosenRoute.routeId,
          startedAt: now,
          endedAt: new Date().toISOString(),
          result: sendResult,
          reason: sendError,
        },
      ],
      events: [
        { id: `evt_${randomUUID().slice(0, 8)}`, status: sendResult, at: now },
      ],
      explanation: {
        title: plan.explanation.title,
        bullets: [
          ...plan.explanation.bullets,
          ...chosenAdapter.explain(),
        ],
      },
      preflight: { mode: plan.preflightMode },
      timestamps: {
        createdAt: now,
        submittedAt: sendResult === "submitted" ? now : undefined,
      },
      terminalReason: sendResult === "failed" ? sendError : undefined,
    };

    this.store.save(receipt);
    return receipt;
  }

  private async gatherAdapterInfo(): Promise<[RouteHealthSnapshot[], RouteEstimate[]]> {
    const results = await Promise.all(
      this.adapters.map(async (adapter) => {
        const health = await adapter.healthCheck();
        const estimate = await adapter.estimate();
        return { health, estimate };
      }),
    );
    return [results.map((r) => r.health), results.map((r) => r.estimate)];
  }
}

function deriveQuality(
  policy: string,
  routeScore: number,
  capApplied: boolean,
): QualityEstimate {
  const labels = {
    FAST: "latency-optimized" as const,
    PROTECTED: "protection-enhanced" as const,
    RELIABLE: "reliability-focused" as const,
  };
  const label = labels[policy as keyof typeof labels] ?? ("latency-optimized" as const);
  const signals: string[] = [];

  if (routeScore > 60) signals.push("Preferred adapter healthy and selected");
  if (!capApplied) signals.push("Fee within configured limits");
  else signals.push("Fee cap applied to stay within budget");

  const score = Math.min(100, Math.max(0, routeScore + (capApplied ? -10 : 10)));

  return { score, label, signals };
}
