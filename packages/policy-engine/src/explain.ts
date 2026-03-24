// ── Explanation Generator: 정책 결정을 사람이 읽을 수 있는 문장으로 ──

import type { SlotFlowPolicy } from "@slotflow/shared";
import type { PlanExplanation } from "@slotflow/shared";
import type { ScoredRoute } from "./scorer.js";

export function generateExplanation(
  policy: SlotFlowPolicy,
  chosen: ScoredRoute,
  fallbackUsed: boolean,
  capApplied: boolean,
): PlanExplanation {
  const bullets: string[] = [];

  // 정책별 핵심 문장
  switch (policy) {
    case "FAST":
      bullets.push("FAST policy selected the lowest-latency healthy adapter.");
      break;
    case "PROTECTED":
      bullets.push(
        "PROTECTED policy preferred a protection-enhanced path for safer execution.",
      );
      break;
    case "RELIABLE":
      bullets.push(
        "RELIABLE policy enabled conservative retries until expiration or confirmation.",
      );
      break;
  }

  // route 선택 이유
  bullets.push(`Chosen route: ${chosen.kind} (${chosen.routeId}) — ${chosen.reason}`);

  // fallback 발생 여부
  if (fallbackUsed) {
    bullets.push("Primary route was unavailable; fell back to the next healthy adapter.");
  }

  // fee cap 적용 여부
  if (capApplied) {
    bullets.push("Fee cap was applied — estimated fee was reduced to stay within the configured limit.");
  }

  const titles: Record<SlotFlowPolicy, string> = {
    FAST: "Optimized for low-latency delivery",
    PROTECTED: "Protection-enhanced route requested",
    RELIABLE: "Reliability-focused delivery with tracked confirmation",
  };

  return { title: titles[policy], bullets };
}
