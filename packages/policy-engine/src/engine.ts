// ── Policy Engine: policy + context → derived execution plan ──

import type {
  DerivedExecutionPlan,
  RouteEstimate,
  RouteHealthSnapshot,
  SlotFlowSendOptions,
} from "@slotflow/shared";
import { POLICY_DEFAULTS, SlotFlowError } from "@slotflow/shared";
import { deriveFeeStrategy } from "./fee.js";
import { generateExplanation } from "./explain.js";
import { scoreRoutes } from "./scorer.js";

export interface PolicyEngineInput {
  options: SlotFlowSendOptions;
  routeHealth: RouteHealthSnapshot[];
  routeEstimates: RouteEstimate[];
}

export function deriveExecutionPlan(input: PolicyEngineInput): DerivedExecutionPlan {
  const { options, routeHealth, routeEstimates } = input;
  const { policy } = options;
  const defaults = POLICY_DEFAULTS[policy];

  // 1. healthy adapter만 필터
  const healthyIds = new Set(
    routeHealth.filter((h) => h.healthy).map((h) => h.routeId),
  );
  const healthyEstimates = routeEstimates.filter((e) => healthyIds.has(e.routeId));

  if (healthyEstimates.length === 0) {
    throw new SlotFlowError("NO_HEALTHY_ROUTE", "No healthy route available for policy execution");
  }

  // 2. 정책 기준 scoring
  const scored = scoreRoutes(policy, healthyEstimates);
  const chosen = scored[0]!;
  const fallbacks = scored.slice(1);

  // 3. fee strategy
  const feeStrategy = deriveFeeStrategy({
    policy,
    maxFeeLamports: options.maxFeeLamports,
  });

  // 4. confirmation target (user override > policy default)
  const confirmationTarget = options.confirmationTarget ?? defaults.confirmationTarget;

  // 5. explanation
  const explanation = generateExplanation(
    policy,
    chosen,
    false, // fallback은 send 시점에 결정
    feeStrategy.capApplied,
  );

  return {
    policy,
    chosenRoute: {
      routeId: chosen.routeId,
      kind: chosen.kind,
      score: chosen.score,
      reason: chosen.reason,
    },
    fallbackOrder: fallbacks.map((f) => ({
      routeId: f.routeId,
      kind: f.kind,
      score: f.score,
      reason: f.reason,
    })),
    feeStrategy,
    preflightMode: defaults.preflightMode,
    confirmationTarget,
    retryStrategy: {
      maxRetries: defaults.maxRetries,
      backoffMs: defaults.retryBackoffMs,
      expirationCheckEnabled: policy === "RELIABLE",
    },
    explanation,
  };
}
