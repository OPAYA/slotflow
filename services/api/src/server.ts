// ── SlotFlow API Server ──

import Fastify from "fastify";
import cors from "@fastify/cors";
import { createMemoryStore } from "./lib/store.js";
import { ExecutionService } from "./lib/execution-service.js";
import { registerExecutionRoutes } from "./routes/executions.js";
import { PublicRpcAdapter, ProtectedAdapter, FastAdapter } from "@slotflow/route-adapters";

const PORT = Number(process.env.PORT ?? 3001);

export async function buildApp() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  // adapters — 환경변수 또는 devnet defaults
  const publicRpc = new PublicRpcAdapter(
    process.env.SLOTFLOW_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com",
  );
  const protectedRpc = new ProtectedAdapter(
    process.env.SLOTFLOW_PROTECTED_RPC_URL ?? "https://api.devnet.solana.com",
  );
  const fastRpc = new FastAdapter(
    process.env.SLOTFLOW_FAST_RPC_URL ?? "https://api.devnet.solana.com",
  );

  const store = createMemoryStore();
  const service = new ExecutionService({
    store,
    adapters: [publicRpc, protectedRpc, fastRpc],
  });

  registerExecutionRoutes(app, service, store);

  // health check
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
