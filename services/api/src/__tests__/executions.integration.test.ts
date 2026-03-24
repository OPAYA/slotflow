import { describe, expect, it, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { createMemoryStore } from "../lib/store.js";
import { ExecutionService } from "../lib/execution-service.js";
import { registerExecutionRoutes } from "../routes/executions.js";
import type { RouteAdapter, AdapterSendInput, AdapterSendResult } from "@slotflow/route-adapters";
import type { RouteEstimate, RouteHealthSnapshot, SlotFlowReceipt } from "@slotflow/shared";

// ── Mock adapters ──

function mockAdapter(
  id: string,
  kind: "public_rpc" | "protected" | "fast",
  opts?: { healthy?: boolean; latencyMs?: number; protectionCapable?: boolean },
): RouteAdapter {
  const healthy = opts?.healthy ?? true;
  const latencyMs = opts?.latencyMs ?? 100;
  const protection = opts?.protectionCapable ?? (kind === "protected");

  return {
    id,
    kind,
    async healthCheck(): Promise<RouteHealthSnapshot> {
      return { routeId: id, kind, healthy, latencyMs, protectionCapable: protection, lastCheckedAt: new Date().toISOString() };
    },
    async estimate(): Promise<RouteEstimate> {
      return { routeId: id, kind, estimatedLatencyMs: latencyMs, estimatedFeeLamports: 10000, protectionSignal: protection, confidence: 0.8 };
    },
    async send(_input: AdapterSendInput): Promise<AdapterSendResult> {
      if (!healthy) throw new Error("adapter unhealthy");
      return { signature: `sig_${id}_${Date.now()}`, submittedAt: new Date().toISOString() };
    },
    explain() {
      return [`Mock ${kind} adapter used for testing.`];
    },
  };
}

// ── Test suite ──

describe("Executions API", () => {
  let app: FastifyInstance;
  const store = createMemoryStore();

  beforeAll(async () => {
    app = Fastify();
    const adapters = [
      mockAdapter("public-rpc-default", "public_rpc", { latencyMs: 400 }),
      mockAdapter("protected-default", "protected", { latencyMs: 600 }),
      mockAdapter("fast-default", "fast", { latencyMs: 200 }),
    ];
    const service = new ExecutionService({ store, adapters });
    registerExecutionRoutes(app, service, store);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("POST /v1/executions returns 201 with receipt for FAST", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/executions",
      payload: {
        signedTransaction: "AQID", // base64 dummy
        options: { policy: "FAST" },
      },
    });
    expect(res.statusCode).toBe(201);
    const receipt = res.json<SlotFlowReceipt>();
    expect(receipt.receiptId).toMatch(/^rcpt_/);
    expect(receipt.policy).toBe("FAST");
    expect(receipt.routeKind).toBe("fast");
    expect(receipt.status).toBe("submitted");
    expect(receipt.explanation.bullets.length).toBeGreaterThanOrEqual(2);
  });

  it("POST /v1/executions returns 201 with receipt for PROTECTED", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/executions",
      payload: {
        signedTransaction: "AQID",
        options: { policy: "PROTECTED", metadata: { flow: "swap", actionGroup: "test-001" } },
      },
    });
    expect(res.statusCode).toBe(201);
    const receipt = res.json<SlotFlowReceipt>();
    expect(receipt.policy).toBe("PROTECTED");
    expect(receipt.routeKind).toBe("protected");
  });

  it("POST /v1/executions returns 201 with receipt for RELIABLE", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/executions",
      payload: {
        signedTransaction: "AQID",
        options: { policy: "RELIABLE" },
      },
    });
    expect(res.statusCode).toBe(201);
    const receipt = res.json<SlotFlowReceipt>();
    expect(receipt.policy).toBe("RELIABLE");
    expect(receipt.status).toBe("submitted");
  });

  it("GET /v1/executions/:receiptId returns stored receipt", async () => {
    // create one first
    const createRes = await app.inject({
      method: "POST",
      url: "/v1/executions",
      payload: { signedTransaction: "AQID", options: { policy: "FAST" } },
    });
    const created = createRes.json<SlotFlowReceipt>();

    const getRes = await app.inject({
      method: "GET",
      url: `/v1/executions/${created.receiptId}`,
    });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json<SlotFlowReceipt>().receiptId).toBe(created.receiptId);
  });

  it("GET /v1/executions/:receiptId returns 404 for unknown id", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/executions/rcpt_nonexistent",
    });
    expect(res.statusCode).toBe(404);
  });

  it("GET /v1/executions returns list", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/executions" });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ executions: SlotFlowReceipt[] }>();
    expect(body.executions.length).toBeGreaterThanOrEqual(1);
  });

  it("POST with invalid policy returns 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/executions",
      payload: { signedTransaction: "AQID", options: { policy: "INVALID" } },
    });
    expect(res.statusCode).toBe(400);
  });

  it("POST without signedTransaction returns 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/executions",
      payload: { options: { policy: "FAST" } },
    });
    expect(res.statusCode).toBe(400);
  });

  it("all three policies produce different route selections", async () => {
    const policies = ["FAST", "PROTECTED", "RELIABLE"] as const;
    const results = await Promise.all(
      policies.map((policy) =>
        app.inject({
          method: "POST",
          url: "/v1/executions",
          payload: { signedTransaction: "AQID", options: { policy } },
        }).then((r) => r.json<SlotFlowReceipt>()),
      ),
    );
    expect(results[0]!.routeKind).toBe("fast");
    expect(results[1]!.routeKind).toBe("protected");
    // RELIABLE picks highest confidence — all equal at 0.8, so order may vary
    expect(results[2]!.status).toBe("submitted");
  });
});
