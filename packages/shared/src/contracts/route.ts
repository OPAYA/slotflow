// ── Route: adapter가 구현하는 전송 경로 ──

export const ROUTE_KINDS = ["public_rpc", "protected", "fast"] as const;
export type RouteKind = (typeof ROUTE_KINDS)[number];

/** adapter가 반환하는 자기 자신의 상태 */
export interface RouteHealthSnapshot {
  routeId: string;
  kind: RouteKind;
  healthy: boolean;
  latencyMs?: number;
  protectionCapable: boolean;
  lastCheckedAt: string;
}

/** adapter estimate 결과 */
export interface RouteEstimate {
  routeId: string;
  kind: RouteKind;
  estimatedLatencyMs: number;
  estimatedFeeLamports: number;
  protectionSignal: boolean;
  confidence: number; // 0-1
}
