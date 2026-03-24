// ── Public RPC Adapter: baseline fallback path ──

import type { RouteEstimate, RouteHealthSnapshot } from "@slotflow/shared";
import type { AdapterSendInput, AdapterSendResult, RouteAdapter } from "./adapter.js";

export class PublicRpcAdapter implements RouteAdapter {
  readonly id = "public-rpc-default";
  readonly kind = "public_rpc" as const;

  constructor(private readonly rpcUrl: string) {}

  async healthCheck(): Promise<RouteHealthSnapshot> {
    // MVP: 단순 reachability check
    const start = Date.now();
    try {
      const res = await fetch(this.rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getHealth" }),
      });
      const latencyMs = Date.now() - start;
      const ok = res.ok;
      return {
        routeId: this.id,
        kind: this.kind,
        healthy: ok,
        latencyMs,
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
      estimatedLatencyMs: 400,
      estimatedFeeLamports: 5000,
      protectionSignal: false,
      confidence: 0.6,
    };
  }

  async send(input: AdapterSendInput): Promise<AdapterSendResult> {
    const skipPreflight = input.preflightMode === "off";
    const res = await fetch(this.rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "sendTransaction",
        params: [
          input.signedTransaction,
          { encoding: "base64", skipPreflight, preflightCommitment: "confirmed" },
        ],
      }),
    });
    const json = (await res.json()) as { result?: string; error?: { message: string } };
    if (json.error) throw new Error(`Public RPC send failed: ${json.error.message}`);
    return {
      signature: json.result!,
      submittedAt: new Date().toISOString(),
    };
  }

  explain(): string[] {
    return [
      "Used the public RPC endpoint as the baseline delivery path.",
      "No additional protection or priority applied beyond standard submission.",
    ];
  }
}
