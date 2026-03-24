// ── Route Scorer: adapter 후보를 정책 기준으로 점수화 ──

import type { RouteEstimate, SlotFlowPolicy } from "@slotflow/shared";

export interface ScoredRoute {
  routeId: string;
  kind: RouteEstimate["kind"];
  score: number;
  reason: string;
}

/**
 * 정책에 따라 route estimate 목록을 점수화하여 정렬한다.
 * score가 높을수록 해당 정책에 더 적합한 route.
 */
export function scoreRoutes(
  policy: SlotFlowPolicy,
  estimates: RouteEstimate[],
): ScoredRoute[] {
  const scored = estimates.map((est) => scoreOne(policy, est));
  return scored.sort((a, b) => b.score - a.score);
}

function scoreOne(policy: SlotFlowPolicy, est: RouteEstimate): ScoredRoute {
  switch (policy) {
    case "FAST":
      return scoreFast(est);
    case "PROTECTED":
      return scoreProtected(est);
    case "RELIABLE":
      return scoreReliable(est);
  }
}

function scoreFast(est: RouteEstimate): ScoredRoute {
  // latency가 낮을수록 높은 점수, 보호 신호는 무관
  const latencyScore = Math.max(0, 100 - est.estimatedLatencyMs / 10);
  const confidenceBonus = est.confidence * 20;
  const score = Math.round(latencyScore + confidenceBonus);

  return {
    routeId: est.routeId,
    kind: est.kind,
    score,
    reason:
      est.kind === "fast"
        ? "Lowest-latency path preferred for FAST policy"
        : `Latency ${est.estimatedLatencyMs}ms, scored as fallback`,
  };
}

function scoreProtected(est: RouteEstimate): ScoredRoute {
  // protection capable 여부가 가장 중요, 그다음 confidence
  const protectionBonus = est.protectionSignal ? 50 : 0;
  const confidenceBonus = est.confidence * 30;
  const latencyPenalty = Math.min(20, est.estimatedLatencyMs / 50);
  const score = Math.round(protectionBonus + confidenceBonus - latencyPenalty);

  return {
    routeId: est.routeId,
    kind: est.kind,
    score,
    reason: est.protectionSignal
      ? "Protection-enhanced path preferred for PROTECTED policy"
      : "No protection signal — lower priority for PROTECTED policy",
  };
}

function scoreReliable(est: RouteEstimate): ScoredRoute {
  // confidence가 가장 중요, 극단적 fee/latency는 패널티
  const confidenceScore = est.confidence * 60;
  const feePenalty = Math.min(15, est.estimatedFeeLamports / 5000);
  const latencyPenalty = Math.min(15, est.estimatedLatencyMs / 100);
  const score = Math.round(confidenceScore - feePenalty - latencyPenalty);

  return {
    routeId: est.routeId,
    kind: est.kind,
    score,
    reason:
      est.confidence >= 0.7
        ? "High-confidence path preferred for RELIABLE policy"
        : "Lower confidence — reduced priority for RELIABLE policy",
  };
}
