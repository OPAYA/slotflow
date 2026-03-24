// ── Dashboard-local types: API 응답 shape만 정의 ──
// @slotflow/shared의 빌드 의존성을 제거하기 위한 로컬 타입

export interface SlotFlowReceipt {
  receiptId: string;
  traceId: string;
  appId?: string;
  signature?: string;
  policy: string;
  routeKind?: string;
  routeId?: string;
  status: string;
  confirmationTarget: string;
  qualityEstimate: {
    score: number;
    label: string;
    signals: string[];
  };
  fee: {
    estimatedAdditionalLamports: number;
    actualAdditionalLamports?: number;
    computeUnitLimit?: number;
    computeUnitPriceMicroLamports?: number;
    capApplied: boolean;
  };
  attempts: {
    id: string;
    routeKind: string;
    routeId: string;
    startedAt: string;
    endedAt?: string;
    result: string;
    reason?: string;
  }[];
  events: {
    id: string;
    status: string;
    at: string;
    reason?: string;
  }[];
  explanation: {
    title: string;
    bullets: string[];
  };
  preflight?: {
    mode: string;
    passed?: boolean;
    error?: string;
  };
  timestamps: {
    createdAt: string;
    submittedAt?: string;
    landedAt?: string;
    confirmedAt?: string;
    finalizedAt?: string;
    expiredAt?: string;
  };
  terminalReason?: string;
}
