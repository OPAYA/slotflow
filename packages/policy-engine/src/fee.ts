// ── Fee Strategy: 정책별 fee band 계산 ──

import type { FeeStrategy } from "@slotflow/shared";
import type { SlotFlowPolicy } from "@slotflow/shared";
import { POLICY_DEFAULTS } from "@slotflow/shared";

const BASE_COMPUTE_UNIT_LIMIT = 200_000;
const BASE_UNIT_PRICE_MICRO_LAMPORTS = 100_000;

export interface FeeInput {
  policy: SlotFlowPolicy;
  maxFeeLamports?: number;
  computeUnitLimitHint?: number;
}

export function deriveFeeStrategy(input: FeeInput): FeeStrategy {
  const defaults = POLICY_DEFAULTS[input.policy];
  const computeUnitLimit = input.computeUnitLimitHint ?? BASE_COMPUTE_UNIT_LIMIT;
  const rawPrice = Math.round(BASE_UNIT_PRICE_MICRO_LAMPORTS * defaults.feeMultiplier);

  // estimated additional fee = (CU limit × price) / 1_000_000
  const rawFee = Math.round((computeUnitLimit * rawPrice) / 1_000_000);
  const cap = input.maxFeeLamports;
  const capApplied = cap != null && rawFee > cap;
  const estimatedFee = capApplied ? cap : rawFee;

  // cap이 적용되면 price를 역산
  const effectivePrice = capApplied
    ? Math.round((cap * 1_000_000) / computeUnitLimit)
    : rawPrice;

  return {
    computeUnitLimit,
    computeUnitPriceMicroLamports: effectivePrice,
    estimatedAdditionalLamports: estimatedFee,
    capApplied,
    policyMultiplier: defaults.feeMultiplier,
  };
}
