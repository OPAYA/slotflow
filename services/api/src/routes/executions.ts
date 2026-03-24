// ── Executions Routes: API endpoints ──

import type { FastifyInstance } from "fastify";
import type { ExecutionService } from "../lib/execution-service.js";
import type { ExecutionStore } from "../lib/store.js";
import type { SlotFlowSendRequest, ApiErrorResponse } from "@slotflow/shared";
import { POLICIES, SlotFlowError } from "@slotflow/shared";

export function registerExecutionRoutes(
  app: FastifyInstance,
  service: ExecutionService,
  store: ExecutionStore,
) {
  // POST /v1/executions — send tx with policy
  app.post<{ Body: SlotFlowSendRequest }>("/v1/executions", async (req, reply) => {
    const body = req.body;

    if (!body?.signedTransaction || !body?.options?.policy) {
      return reply.status(400).send(errorResponse("INVALID_REQUEST", "signedTransaction and options.policy are required"));
    }

    if (!POLICIES.includes(body.options.policy)) {
      return reply.status(400).send(errorResponse("UNSUPPORTED_POLICY", `Unknown policy: ${body.options.policy}`));
    }

    try {
      const receipt = await service.execute(body);
      return reply.status(201).send(receipt);
    } catch (e) {
      if (e instanceof SlotFlowError) {
        const status = e.code === "NO_HEALTHY_ROUTE" ? 503 : 500;
        return reply.status(status).send(errorResponse(e.code, e.message, e.retryable));
      }
      return reply.status(500).send(errorResponse("ADAPTER_SEND_FAILED", "Unexpected error", true));
    }
  });

  // GET /v1/executions/:receiptId
  app.get<{ Params: { receiptId: string } }>("/v1/executions/:receiptId", async (req, reply) => {
    const receipt = store.get(req.params.receiptId);
    if (!receipt) {
      return reply.status(404).send(errorResponse("RECEIPT_NOT_FOUND", `Receipt ${req.params.receiptId} not found`));
    }
    return receipt;
  });

  // GET /v1/executions
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

  // GET /v1/metrics/compare
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

function errorResponse(code: string, message: string, retryable?: boolean): ApiErrorResponse {
  return { error: { code: code as ApiErrorResponse["error"]["code"], message, retryable } };
}
