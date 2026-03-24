// ── Route Adapter Interface ──

import type { RouteEstimate, RouteHealthSnapshot, RouteKind } from "@slotflow/shared";

export interface AdapterSendInput {
  signedTransaction: string;
  computeUnitLimit: number;
  computeUnitPriceMicroLamports: number;
  preflightMode: "on" | "off" | "adaptive";
}

export interface AdapterSendResult {
  signature: string;
  submittedAt: string;
  routeMetadata?: Record<string, unknown>;
}

export interface RouteAdapter {
  readonly id: string;
  readonly kind: RouteKind;

  /** adapter가 현재 사용 가능한지 */
  healthCheck(): Promise<RouteHealthSnapshot>;

  /** 예상 비용/지연/보호 신호 */
  estimate(): Promise<RouteEstimate>;

  /** 트랜잭션 전송 */
  send(input: AdapterSendInput): Promise<AdapterSendResult>;

  /** dashboard/receipt에 쓸 설명 문장 */
  explain(): string[];
}
