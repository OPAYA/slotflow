// ── Execution Plan: policy engine이 생성하는 실행 계획 ──

import type {
  ConfirmationTarget,
  PolicyDefaults,
  SlotFlowPolicy,
} from "./policy.js";
import type { RouteKind } from "./route.js";

/** 정책 엔진이 만드는 derived execution plan */
export interface DerivedExecutionPlan {
  policy: SlotFlowPolicy;
  chosenRoute: RouteCandidate;
  fallbackOrder: RouteCandidate[];
  feeStrategy: FeeStrategy;
  preflightMode: "on" | "off" | "adaptive";
  confirmationTarget: ConfirmationTarget;
  retryStrategy: RetryStrategy;
  explanation: PlanExplanation;
}

export interface RouteCandidate {
  routeId: string;
  kind: RouteKind;
  score: number;
  reason: string;
}

export interface FeeStrategy {
  computeUnitLimit: number;
  computeUnitPriceMicroLamports: number;
  estimatedAdditionalLamports: number;
  capApplied: boolean;
  policyMultiplier: number;
}

export interface RetryStrategy {
  maxRetries: number;
  backoffMs: number;
  expirationCheckEnabled: boolean;
}

export interface PlanExplanation {
  title: string;
  bullets: string[];
}
