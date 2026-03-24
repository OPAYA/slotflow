// ── SlotFlow API Server ──

import Fastify from "fastify";
import cors from "@fastify/cors";
import { createMemoryStore } from "./lib/store.js";
import { ExecutionService } from "./lib/execution-service.js";
import { registerExecutionRoutes } from "./routes/executions.js";
import {
  createPublicRpcAdapter,
  createProtectedAdapter,
  createFastAdapter,
  createDefaultMockAdapters,
  type RouteAdapter,
} from "@slotflow/route-adapters";
import {
  ExecutionRegistry,
  startMonitorLoop,
  type StatusPoller,
} from "@slotflow/tx-monitor";

const PORT = Number(process.env.PORT ?? 3001);
const MOCK_MODE = process.env.SLOTFLOW_MOCK === "true";
const POLL_INTERVAL_MS = Number(process.env.SLOTFLOW_POLL_INTERVAL_MS ?? 2000);

export async function buildApp() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  let adapters: RouteAdapter[];

  if (MOCK_MODE) {
    app.log.info("Running in MOCK mode — using deterministic mock adapters");
    adapters = createDefaultMockAdapters();
  } else {
    adapters = [
      createPublicRpcAdapter(process.env.SLOTFLOW_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com"),
      createProtectedAdapter(process.env.SLOTFLOW_PROTECTED_RPC_URL ?? "https://api.devnet.solana.com"),
      createFastAdapter(process.env.SLOTFLOW_FAST_RPC_URL ?? "https://api.devnet.solana.com"),
    ];
  }

  const store = createMemoryStore();
  const registry = new ExecutionRegistry();
  const service = new ExecutionService({ store, adapters, registry });

  registerExecutionRoutes(app, service, store);

  // ── Monitor loop: poll RPC for status updates ──
  const rpcUrl = process.env.SLOTFLOW_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com";
  const poller: StatusPoller = {
    async poll(signature) {
      if (MOCK_MODE) {
        // mock mode: simulate progression to confirmed
        return { found: true, commitment: "confirmed" as const };
      }
      try {
        const res = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getSignatureStatuses",
            params: [[signature], { searchTransactionHistory: false }],
          }),
        });
        const json = await res.json() as {
          result?: { value: Array<{ confirmationStatus?: string; err?: unknown } | null> };
        };
        const status = json.result?.value?.[0];
        if (!status) return { found: false };
        if (status.err) return { found: true, err: `chain_error: ${JSON.stringify(status.err)}` };
        return {
          found: true,
          commitment: status.confirmationStatus as "processed" | "confirmed" | "finalized" | undefined,
        };
      } catch {
        return { found: false };
      }
    },
  };

  const stopMonitor = startMonitorLoop({
    getActiveExecutions: () => registry.getActive(),
    onTransition: (event) => {
      try {
        store.updateStatus(event.receiptId, event.to, {
          id: `evt_${Date.now().toString(36)}`,
          status: event.to,
          at: event.at,
          reason: event.reason,
        });
        registry.updateStatus(event.receiptId, event.to);
        app.log.info({ receiptId: event.receiptId, from: event.from, to: event.to }, "monitor transition");
      } catch (err) {
        app.log.error({ err, event }, "monitor transition failed");
      }
    },
    poller,
    intervalMs: POLL_INTERVAL_MS,
  });

  app.addHook("onClose", () => stopMonitor());

  app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

  return app;
}

// direct run
const app = await buildApp();
app.listen({ port: PORT, host: "0.0.0.0" }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
});
