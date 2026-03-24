// ── Execution Service: orchestration만 담당, 각 관심사는 분리 ──

import { randomUUID } from "node:crypto";
import type {
  SlotFlowReceipt,
  SlotFlowSendRequest,
  SlotFlowPolicy,
  QualityEstimate,
  DerivedExecutionPlan,
  RouteEstimate,
  RouteHealthSnapshot,
} from "@slotflow/shared";
import { SlotFlowError } from "@slotflow/shared";
import { deriveExecutionPlan } from "@slotflow/policy-engine";
import type { RouteAdapter } from "@slotflow/route-adapters";
import type { ExecutionRegistry } from "@slotflow/tx-monitor";
import type { ExecutionStore } from "./store.js";

export interface ExecutionServiceDeps {
  store: ExecutionStore;
  adapters: RouteAdapter[];
  registry?: ExecutionRegistry;
}

export class ExecutionService {
  private store: ExecutionStore;
  private adapters: RouteAdapter[];
  private registry?: ExecutionRegistry;

  constructor(deps: ExecutionServiceDeps) {
    this.store = deps.store;
    this.adapters = deps.adapters;
    this.registry = deps.registry;
  }

  async execute(request: SlotFlowSendRequest): Promise<SlotFlowReceipt> {
    const { options } = request;
    const ids = generateIds();
    const now = new Date().toISOString();

    // 1. gather adapter info
    const [healthSnapshots, estimates] = await this.gatherAdapterInfo();

    // 2. derive execution plan
    let plan: DerivedExecutionPlan;
    try {
      plan = deriveExecutionPlan({ options, routeHealth: healthSnapshots, routeEstimates: estimates });
    } catch (err) {
      throw err instanceof SlotFlowError ? err
        : new SlotFlowError("NO_HEALTHY_ROUTE", "No healthy route available");
    }

    // 3. dispatch to chosen adapter
    const chosenAdapter = this.adapters.find((a) => a.id === plan.chosenRoute.routeId);
    if (!chosenAdapter) {
      throw new SlotFlowError("NO_HEALTHY_ROUTE", `Adapter ${plan.chosenRoute.routeId} not found`);
    }

    const sendResult = await this.dispatchToAdapter(chosenAdapter, request, plan);

    // 4. build and persist receipt
    const receipt = buildReceipt({
      ids,
      now,
      plan,
      sendResult,
      options,
      adapterExplanation: chosenAdapter.explain(),
    });

    this.store.save(receipt);

    // 5. register for monitoring if submitted successfully
    if (receipt.status === "submitted" && receipt.signature && this.registry) {
      this.registry.register({
        receiptId: receipt.receiptId,
        signature: receipt.signature,
        currentStatus: receipt.status,
        confirmationTarget: receipt.confirmationTarget,
        maxRetries: plan.retryStrategy.maxRetries,
        retryCount: 0,
        createdAt: Date.now(),
      });
    }

    return receipt;
  }

  private async dispatchToAdapter(
    adapter: RouteAdapter,
    request: SlotFlowSendRequest,
    plan: DerivedExecutionPlan,
  ): Promise<AdapterDispatchResult> {
    try {
      const result = await adapter.send({
        signedTransaction: request.signedTransaction,
        computeUnitLimit: plan.feeStrategy.computeUnitLimit,
        computeUnitPriceMicroLamports: plan.feeStrategy.computeUnitPriceMicroLamports,
        preflightMode: plan.preflightMode,
      });
      return { status: "submitted", signature: result.signature };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown send error";
      return { status: "failed", error: message };
    }
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

// ── Pure helpers ──

interface AdapterDispatchResult {
  status: "submitted" | "failed";
  signature?: string;
  error?: string;
}

function generateIds() {
  return {
    receiptId: `rcpt_${randomUUID().slice(0, 12)}`,
    traceId: `trace_${randomUUID().slice(0, 12)}`,
    attemptId: `att_${randomUUID().slice(0, 8)}`,
    eventId: `evt_${randomUUID().slice(0, 8)}`,
  };
}

function buildReceipt(input: {
  ids: ReturnType<typeof generateIds>;
  now: string;
  plan: DerivedExecutionPlan;
  sendResult: AdapterDispatchResult;
  options: SlotFlowSendRequest["options"];
  adapterExplanation: string[];
}): SlotFlowReceipt {
  const { ids, now, plan, sendResult, options, adapterExplanation } = input;

  return {
    receiptId: ids.receiptId,
    traceId: ids.traceId,
    appId: options.appId,
    signature: sendResult.signature,
    policy: plan.policy,
    routeKind: plan.chosenRoute.kind,
    routeId: plan.chosenRoute.routeId,
    status: sendResult.status,
    confirmationTarget: plan.confirmationTarget,
    qualityEstimate: deriveQuality(plan.policy, plan.chosenRoute.score, plan.feeStrategy.capApplied),
    fee: {
      estimatedAdditionalLamports: plan.feeStrategy.estimatedAdditionalLamports,
      computeUnitLimit: plan.feeStrategy.computeUnitLimit,
      computeUnitPriceMicroLamports: plan.feeStrategy.computeUnitPriceMicroLamports,
      capApplied: plan.feeStrategy.capApplied,
    },
    attempts: [{
      id: ids.attemptId,
      routeKind: plan.chosenRoute.kind,
      routeId: plan.chosenRoute.routeId,
      startedAt: now,
      endedAt: new Date().toISOString(),
      result: sendResult.status,
      reason: sendResult.error,
    }],
    events: [{ id: ids.eventId, status: sendResult.status, at: now }],
    explanation: {
      title: plan.explanation.title,
      bullets: [...plan.explanation.bullets, ...adapterExplanation],
    },
    preflight: { mode: plan.preflightMode },
    timestamps: {
      createdAt: now,
      submittedAt: sendResult.status === "submitted" ? now : undefined,
    },
    terminalReason: sendResult.status === "failed" ? sendResult.error : undefined,
  };
}

const QUALITY_LABELS: Record<SlotFlowPolicy, QualityEstimate["label"]> = {
  FAST: "latency-optimized",
  PROTECTED: "protection-enhanced",
  RELIABLE: "reliability-focused",
};

function deriveQuality(
  policy: SlotFlowPolicy,
  routeScore: number,
  capApplied: boolean,
): QualityEstimate {
  const signals: string[] = [];
  if (routeScore > 60) signals.push("Preferred adapter healthy and selected");
  if (!capApplied) signals.push("Fee within configured limits");
  else signals.push("Fee cap applied to stay within budget");

  return {
    score: Math.min(100, Math.max(0, routeScore + (capApplied ? -10 : 10))),
    label: QUALITY_LABELS[policy],
    signals,
  };
}
