// ── Policy: 앱이 선언하는 실행 의도 ──

export const POLICIES = ["FAST", "PROTECTED", "RELIABLE"] as const;
export type SlotFlowPolicy = (typeof POLICIES)[number];

export const CONFIRMATION_TARGETS = [
  "processed",
  "confirmed",
  "finalized",
] as const;
export type ConfirmationTarget = (typeof CONFIRMATION_TARGETS)[number];

/** 앱이 SDK에 넘기는 전송 옵션 */
export interface SlotFlowSendOptions {
  policy: SlotFlowPolicy;
  appId?: string;
  maxFeeLamports?: number;
  confirmationTarget?: ConfirmationTarget;
  metadata?: Record<string, string | number | boolean | null>;
  tags?: string[];
}

/** HTTP request body */
export interface SlotFlowSendRequest {
  /** base64-encoded signed transaction */
  signedTransaction: string;
  options: SlotFlowSendOptions;
}

// ── Policy defaults ──

export interface PolicyDefaults {
  confirmationTarget: ConfirmationTarget;
  preflightMode: "on" | "off" | "adaptive";
  feeMultiplier: number;
  maxRetries: number;
  retryBackoffMs: number;
}

export const POLICY_DEFAULTS: Record<SlotFlowPolicy, PolicyDefaults> = {
  FAST: {
    confirmationTarget: "processed",
    preflightMode: "adaptive",
    feeMultiplier: 1.5,
    maxRetries: 1,
    retryBackoffMs: 500,
  },
  PROTECTED: {
    confirmationTarget: "confirmed",
    preflightMode: "on",
    feeMultiplier: 1.2,
    maxRetries: 2,
    retryBackoffMs: 1000,
  },
  RELIABLE: {
    confirmationTarget: "confirmed",
    preflightMode: "on",
    feeMultiplier: 1.0,
    maxRetries: 5,
    retryBackoffMs: 2000,
  },
};
