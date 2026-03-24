// ── Fast Adapter: latency-first path ──

import type { RouteEstimate, RouteHealthSnapshot } from "@slotflow/shared";
import type { AdapterSendInput, AdapterSendResult, RouteAdapter } from "./adapter.js";

export class FastAdapter implements RouteAdapter {
  readonly id = "fast-default";
  readonly kind = "fast" as const;

  constructor(private readonly rpcUrl: string) {}

  async healthCheck(): Promise<RouteHealthSnapshot> {
    const start = Date.now();
    try {
      const res = await fetch(this.rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getHealth" }),
      });
      return {
        routeId: this.id,
        kind: this.kind,
        healthy: res.ok,
        latencyMs: Date.now() - start,
        protectionCapable: false,
        lastCheckedAt: new Date().toISOString(),
      };
    } catch {
      return {
        routeId: this.id,
        kind: this.kind,
        healthy: false,
        latencyMs: Date.now() - start,
        protectionCapable: false,
        lastCheckedAt: new Date().toISOString(),
      };
    }
  }

  async estimate(): Promise<RouteEstimate> {
    return {
      routeId: this.id,
      kind: this.kind,
      estimatedLatencyMs: 200,
      estimatedFeeLamports: 25000,
      protectionSignal: false,
      confidence: 0.7,
    };
  }

  async send(input: AdapterSendInput): Promise<AdapterSendResult> {
    // Fast path: skip preflight for speed, aggressive fee
    const res = await fetch(this.rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "sendTransaction",
        params: [
          input.signedTransaction,
          { encoding: "base64", skipPreflight: true, preflightCommitment: "processed" },
        ],
      }),
    });
    const json = (await res.json()) as { result?: string; error?: { message: string } };
    if (json.error) throw new Error(`Fast send failed: ${json.error.message}`);
    return {
      signature: json.result!,
      submittedAt: new Date().toISOString(),
      routeMetadata: { latencyOptimized: true },
    };
  }

  explain(): string[] {
    return [
      "Selected the lowest-latency delivery path for fastest landing.",
      "Applied aggressive fee posture to maximize inclusion priority.",
      "Skipped preflight to minimize submission overhead.",
    ];
  }
}
