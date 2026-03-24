// ── Mock Adapters: 데모/테스트용 deterministic adapter ──

import { randomUUID } from "node:crypto";
import type { RouteEstimate, RouteHealthSnapshot, RouteKind } from "@slotflow/shared";
import type { AdapterSendInput, AdapterSendResult, RouteAdapter } from "./adapter.js";

interface MockAdapterConfig {
  id: string;
  kind: RouteKind;
  latencyMs: number;
  feeLamports: number;
  protectionCapable: boolean;
  failRate?: number; // 0-1, default 0
}

export function createMockAdapter(config: MockAdapterConfig): RouteAdapter {
  const {
    id,
    kind,
    latencyMs,
    feeLamports,
    protectionCapable,
    failRate = 0,
  } = config;

  return {
    id,
    kind,

    async healthCheck(): Promise<RouteHealthSnapshot> {
      return {
        routeId: id,
        kind,
        healthy: true,
        latencyMs,
        protectionCapable,
        lastCheckedAt: new Date().toISOString(),
      };
    },

    async estimate(): Promise<RouteEstimate> {
      return {
        routeId: id,
        kind,
        estimatedLatencyMs: latencyMs,
        estimatedFeeLamports: feeLamports,
        protectionSignal: protectionCapable,
        confidence: 0.85,
      };
    },

    async send(_input: AdapterSendInput): Promise<AdapterSendResult> {
      // simulate network latency
      await new Promise((r) => setTimeout(r, Math.random() * latencyMs));

      if (Math.random() < failRate) {
        throw new Error(`Mock ${kind} adapter simulated failure`);
      }

      return {
        signature: `mock_${kind}_${randomUUID().slice(0, 16)}`,
        submittedAt: new Date().toISOString(),
        routeMetadata: { mock: true, kind },
      };
    },

    explain(): string[] {
      const explanations: Record<RouteKind, string[]> = {
        fast: [
          "Selected the lowest-latency delivery path for fastest landing.",
          "Applied aggressive fee posture to maximize inclusion priority.",
        ],
        protected: [
          "Preferred a protection-enhanced route to reduce harmful execution risk.",
          "Kept preflight enabled for safer execution validation.",
        ],
        public_rpc: [
          "Used the public RPC endpoint as the baseline delivery path.",
          "No additional protection or priority applied beyond standard submission.",
        ],
      };
      return explanations[kind];
    },
  };
}

/** 기본 mock adapter 3종 세트 */
export function createDefaultMockAdapters(): RouteAdapter[] {
  return [
    createMockAdapter({
      id: "public-rpc-default",
      kind: "public_rpc",
      latencyMs: 400,
      feeLamports: 5000,
      protectionCapable: false,
    }),
    createMockAdapter({
      id: "protected-default",
      kind: "protected",
      latencyMs: 600,
      feeLamports: 15000,
      protectionCapable: true,
    }),
    createMockAdapter({
      id: "fast-default",
      kind: "fast",
      latencyMs: 150,
      feeLamports: 25000,
      protectionCapable: false,
    }),
  ];
}
