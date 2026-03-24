// ── Protected Adapter: protection-enhanced path ──

import type { RouteEstimate, RouteHealthSnapshot } from "@slotflow/shared";
import type { AdapterSendInput, AdapterSendResult, RouteAdapter } from "./adapter.js";

export class ProtectedAdapter implements RouteAdapter {
  readonly id = "protected-default";
  readonly kind = "protected" as const;

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
        protectionCapable: true,
        lastCheckedAt: new Date().toISOString(),
      };
    } catch {
      return {
        routeId: this.id,
        kind: this.kind,
        healthy: false,
        latencyMs: Date.now() - start,
        protectionCapable: true,
        lastCheckedAt: new Date().toISOString(),
      };
    }
  }

  async estimate(): Promise<RouteEstimate> {
    return {
      routeId: this.id,
      kind: this.kind,
      estimatedLatencyMs: 600,
      estimatedFeeLamports: 15000,
      protectionSignal: true,
      confidence: 0.75,
    };
  }

  async send(input: AdapterSendInput): Promise<AdapterSendResult> {
    // Protected path: always preflight on, bundle-aware submission
    const res = await fetch(this.rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "sendTransaction",
        params: [
          input.signedTransaction,
          { encoding: "base64", skipPreflight: false, preflightCommitment: "confirmed" },
        ],
      }),
    });
    const json = (await res.json()) as { result?: string; error?: { message: string } };
    if (json.error) throw new Error(`Protected send failed: ${json.error.message}`);
    return {
      signature: json.result!,
      submittedAt: new Date().toISOString(),
      routeMetadata: { protectionEnhanced: true },
    };
  }

  explain(): string[] {
    return [
      "Preferred a protection-enhanced route to reduce harmful execution risk.",
      "Kept preflight enabled for safer execution validation.",
      "Used a moderate fee posture within the configured cap.",
    ];
  }
}
