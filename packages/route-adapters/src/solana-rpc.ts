// ── Solana RPC Adapter: config-driven, 중복 제거 ──

import type { RouteEstimate, RouteHealthSnapshot, RouteKind } from "@slotflow/shared";
import type { AdapterSendInput, AdapterSendResult, RouteAdapter } from "./adapter.js";

export interface SolanaRpcAdapterConfig {
  id: string;
  kind: RouteKind;
  rpcUrl: string;
  defaultSkipPreflight: boolean;
  preflightCommitment: "processed" | "confirmed";
  estimateDefaults: {
    latencyMs: number;
    feeLamports: number;
    protectionSignal: boolean;
    confidence: number;
  };
  explanationLines: string[];
}

/**
 * 단일 구현으로 public/protected/fast를 모두 커버하는 adapter.
 * 행동 차이는 config에서 온다.
 */
export class SolanaRpcAdapter implements RouteAdapter {
  readonly id: string;
  readonly kind: RouteKind;

  constructor(private readonly config: SolanaRpcAdapterConfig) {
    this.id = config.id;
    this.kind = config.kind;
  }

  async healthCheck(): Promise<RouteHealthSnapshot> {
    const start = Date.now();
    try {
      const res = await fetch(this.config.rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getHealth" }),
      });
      return {
        routeId: this.id,
        kind: this.kind,
        healthy: res.ok,
        latencyMs: Date.now() - start,
        protectionCapable: this.config.estimateDefaults.protectionSignal,
        lastCheckedAt: new Date().toISOString(),
      };
    } catch {
      return {
        routeId: this.id,
        kind: this.kind,
        healthy: false,
        latencyMs: Date.now() - start,
        protectionCapable: this.config.estimateDefaults.protectionSignal,
        lastCheckedAt: new Date().toISOString(),
      };
    }
  }

  async estimate(): Promise<RouteEstimate> {
    const d = this.config.estimateDefaults;
    return {
      routeId: this.id,
      kind: this.kind,
      estimatedLatencyMs: d.latencyMs,
      estimatedFeeLamports: d.feeLamports,
      protectionSignal: d.protectionSignal,
      confidence: d.confidence,
    };
  }

  async send(input: AdapterSendInput): Promise<AdapterSendResult> {
    const skipPreflight =
      this.config.defaultSkipPreflight || input.preflightMode === "off";

    const res = await fetch(this.config.rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "sendTransaction",
        params: [
          input.signedTransaction,
          {
            encoding: "base64",
            skipPreflight,
            preflightCommitment: this.config.preflightCommitment,
          },
        ],
      }),
    });

    const json = (await res.json()) as { result?: string; error?: { message: string } };
    if (json.error) {
      throw new Error(`${this.kind} adapter send failed: ${json.error.message}`);
    }

    return {
      signature: json.result!,
      submittedAt: new Date().toISOString(),
      routeMetadata: { kind: this.kind, adapterId: this.id },
    };
  }

  explain(): string[] {
    return this.config.explanationLines;
  }
}

// ── Preset configs ──

export function createPublicRpcAdapter(rpcUrl: string): RouteAdapter {
  return new SolanaRpcAdapter({
    id: "public-rpc-default",
    kind: "public_rpc",
    rpcUrl,
    defaultSkipPreflight: false,
    preflightCommitment: "confirmed",
    estimateDefaults: { latencyMs: 400, feeLamports: 5000, protectionSignal: false, confidence: 0.6 },
    explanationLines: [
      "Used the public RPC endpoint as the baseline delivery path.",
      "No additional protection or priority applied beyond standard submission.",
    ],
  });
}

export function createProtectedAdapter(rpcUrl: string): RouteAdapter {
  return new SolanaRpcAdapter({
    id: "protected-default",
    kind: "protected",
    rpcUrl,
    defaultSkipPreflight: false,
    preflightCommitment: "confirmed",
    estimateDefaults: { latencyMs: 600, feeLamports: 15000, protectionSignal: true, confidence: 0.75 },
    explanationLines: [
      "Preferred a protection-enhanced route to reduce harmful execution risk.",
      "Kept preflight enabled for safer execution validation.",
      "Used a moderate fee posture within the configured cap.",
    ],
  });
}

export function createFastAdapter(rpcUrl: string): RouteAdapter {
  return new SolanaRpcAdapter({
    id: "fast-default",
    kind: "fast",
    rpcUrl,
    defaultSkipPreflight: true,
    preflightCommitment: "processed",
    estimateDefaults: { latencyMs: 200, feeLamports: 25000, protectionSignal: false, confidence: 0.7 },
    explanationLines: [
      "Selected the lowest-latency delivery path for fastest landing.",
      "Applied aggressive fee posture to maximize inclusion priority.",
      "Skipped preflight to minimize submission overhead.",
    ],
  });
}
