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

const PORT = Number(process.env.PORT ?? 3001);
const MOCK_MODE = process.env.SLOTFLOW_MOCK === "true";

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
  const service = new ExecutionService({ store, adapters });

  registerExecutionRoutes(app, service, store);

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
