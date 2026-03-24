// ── Executions Routes: API endpoints ──

import type { FastifyInstance } from "fastify";
import type { ExecutionService } from "../lib/execution-service.js";
import type { ExecutionStore } from "../lib/store.js";
import type { SlotFlowSendRequest, ApiError } from "@slotflow/shared";
import { POLICIES } from "@slotflow/shared";

export function registerExecutionRoutes(
  app: FastifyInstance,
  service: ExecutionService,
  store: ExecutionStore,
) {
  // POST /v1/executions — send tx with policy
  app.post<{ Body: SlotFlowSendRequest }>("/v1/executions", async (req, reply) => {
    const body = req.body;

    // validation
    if (!body?.signedTransaction || !body?.options?.policy) {
      const err: ApiError = {
        error: { code: "INVALID_REQUEST", message: "signedTransaction and options.policy are required" },
      };
      return reply.status(400).send(err);
    }

    if (!POLICIES.includes(body.options.policy)) {
      const err: ApiError = {
        error: { code: "UNSUPPORTED_POLICY", message: `Unknown policy: ${body.options.policy}` },
      };
      return reply.status(400).send(err);
    }

    try {
      const receipt = await service.execute(body);
      return reply.status(201).send(receipt);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      const code = message === "NO_HEALTHY_ROUTE" ? "NO_HEALTHY_ROUTE" : "ADAPTER_SEND_FAILED";
      const err: ApiError = {
        error: { code, message, retryable: code === "ADAPTER_SEND_FAILED" },
      };
      return reply.status(code === "NO_HEALTHY_ROUTE" ? 503 : 500).send(err);
    }
  });

  // GET /v1/executions/:receiptId — get receipt
  app.get<{ Params: { receiptId: string } }>("/v1/executions/:receiptId", async (req, reply) => {
    const receipt = store.get(req.params.receiptId);
    if (!receipt) {
      const err: ApiError = {
        error: { code: "RECEIPT_NOT_FOUND", message: `Receipt ${req.params.receiptId} not found` },
      };
      return reply.status(404).send(err);
    }
    return receipt;
  });

  // GET /v1/executions — list executions
  app.get("/v1/executions", async (req) => {
    const query = req.query as Record<string, string>;
    const executions = store.list({
      policy: query.policy,
      status: query.status,
      appId: query.appId,
      actionGroup: query.actionGroup,
      limit: query.limit ? Number(query.limit) : 50,
    });
    return { executions, nextCursor: undefined };
  });

  // GET /v1/metrics/compare — policy comparison
  app.get("/v1/metrics/compare", async (req) => {
    const query = req.query as Record<string, string>;
    const all = store.list({ actionGroup: query.actionGroup });

    const rows = all.map((r) => ({
      policy: r.policy,
      routeKind: r.routeKind,
      landedLatencyMs: r.timestamps.landedAt && r.timestamps.submittedAt
        ? new Date(r.timestamps.landedAt).getTime() - new Date(r.timestamps.submittedAt).getTime()
        : undefined,
      retryCount: r.attempts.length - 1,
      estimatedAdditionalLamports: r.fee.estimatedAdditionalLamports,
      actualAdditionalLamports: r.fee.actualAdditionalLamports,
      finalStatus: r.status,
    }));

    return { rows };
  });
}
