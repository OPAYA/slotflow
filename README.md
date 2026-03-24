# SlotFlow

**Policy-driven execution layer for Solana.**

Solana apps currently tune fee knobs, pick routes, and pray.
SlotFlow replaces that with a single declaration: *how* you want your transaction executed.

```ts
import { SlotFlowClient } from "@slotflow/sdk";

const sf = new SlotFlowClient({ baseUrl: "http://localhost:3001" });

const receipt = await sf.send(signedTx, {
  policy: "PROTECTED",          // FAST | PROTECTED | RELIABLE
  maxFeeLamports: 50_000,
});

console.log(receipt.status);      // "submitted"
console.log(receipt.routeKind);   // "protected"
console.log(receipt.explanation); // why this route was chosen
```

---

## Three Policies, One Interface

| Policy | Intent | Route Priority | Confirmation | Retry |
|--------|--------|---------------|-------------|-------|
| **`FAST`** | Lowest landed latency | fast > protected > public | `processed` | Minimal |
| **`PROTECTED`** | Reduce harmful execution risk | protected > public > fast | `confirmed` | Limited |
| **`RELIABLE`** | Track to terminal state, no ambiguity | public > protected > fast | `confirmed` | Conservative |

Each policy produces a **different execution plan** with different route scoring, fee posture, preflight behavior, and retry strategy. Every decision is recorded in an **explainable receipt**.

---

## Architecture

```
App / Wallet / Demo
      |
  SlotFlow SDK          ---- send(signedTx, { policy })
      |
  SlotFlow API           ---- POST /v1/executions
      |
  Policy Engine          ---- score routes, compute fees, generate explanation
      |
  Route Adapter          ---- SolanaRpcAdapter (config-driven, single impl)
      |                        public_rpc | protected | fast
  Solana Network
      |
  Tx Monitor             ---- poll RPC, drive state machine transitions
      |
  Receipt Store          ---- state-machine-enforced, structuredClone isolation
      |
  Dashboard              ---- executions list, receipt detail, policy comparison
```

### Key Design Decisions

- **Config-driven adapter** -- one `SolanaRpcAdapter` class, three factory functions. Zero duplication.
- **State machine at the store boundary** -- `canTransition()` is enforced on every write, not just in the monitor.
- **Typed domain errors** -- `SlotFlowError(code, message, retryable)` everywhere. No string matching.
- **Monitor loop connected** -- `ExecutionRegistry` tracks active receipts, `startMonitorLoop` drives `submitted -> confirmed -> finalized`.
- **Compute budget injection** -- `injectComputeBudget()` available pre-signature for actual fee application.

---

## Project Structure

```
slotflow/
  packages/
    shared/            Core contracts: policy, receipt, route, error types
    sdk/               SlotFlowClient (send, getReceipt, subscribe)
    policy-engine/     Policy -> execution plan (scorer + fee + explain)
    route-adapters/    SolanaRpcAdapter + mock adapters
    solana-utils/      Keypair, transfer, airdrop, compute budget helpers
  services/
    api/               Fastify API server + execution orchestration
  workers/
    tx-monitor/        State machine + polling monitor + loop
  apps/
    dashboard/         Executions list, receipt detail, comparison
    demo-swap/         PROTECTED policy demo (token swap)
    demo-payments/     RELIABLE policy demo (payment tracking)
  scripts/
    seed.ts            Mock data seeding (3 policies)
    seed-devnet.ts     Real devnet transaction seeding
    smoke.ts           9-point API verification
```

---

## Quick Start

```bash
# Install
pnpm install

# Start API server (mock mode -- no RPC needed)
SLOTFLOW_MOCK=true pnpm api

# Seed demo data
pnpm seed

# Start dashboard
pnpm dashboard              # http://localhost:3000

# Start demo apps
pnpm --filter @slotflow/demo-swap dev      # http://localhost:3002
pnpm --filter @slotflow/demo-payments dev   # http://localhost:3003
```

### Devnet Mode

```bash
# 1. Fund the demo wallet
#    Visit https://faucet.solana.com
#    Paste the payer address from .keys/demo-payer.json

# 2. Start API with real adapters
SLOTFLOW_MOCK=false pnpm api

# 3. Seed real transactions
pnpm seed:devnet
```

---

## Verification

```bash
# Unit + integration tests (56 tests)
pnpm test

# Smoke tests against running API (9 checks)
pnpm smoke

# Production builds
pnpm --filter @slotflow/dashboard build
pnpm --filter @slotflow/demo-swap build
pnpm --filter @slotflow/demo-payments build
```

---

## API

### `POST /v1/executions`

Send a signed transaction with a policy.

```json
{
  "signedTransaction": "BASE64_TX",
  "options": {
    "policy": "PROTECTED",
    "appId": "demo-swap",
    "maxFeeLamports": 50000,
    "confirmationTarget": "confirmed"
  }
}
```

Returns a full `SlotFlowReceipt` with status, route, fee, explanation, and timeline.

### `GET /v1/executions/:receiptId`

Fetch the latest receipt state.

### `GET /v1/executions`

List executions. Filter by `policy`, `status`, `appId`.

### `GET /v1/metrics/compare?actionGroup=...`

Compare policy results side-by-side for the same action group.

---

## Receipt Lifecycle

```
accepted -> planned -> submitted -> relayed -> processed -> confirmed -> finalized
                          |            |          |
                          +-> failed   +-> expired +-> expired
                          +-> expired
```

Terminal states: `finalized`, `expired`, `failed`.
The state machine is enforced at the store level -- invalid transitions throw `SlotFlowError`.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Runtime | Node.js 20, TypeScript |
| Package manager | pnpm workspaces |
| API server | Fastify |
| Frontend | Next.js 15 App Router |
| Validation | Zod-ready (types first) |
| Test | Vitest |
| Storage | In-memory (interface-based, swappable to Postgres) |

---

## Language Policy

SlotFlow does not make guarantees. All copy uses honest language:

| Do not say | Say instead |
|-----------|-------------|
| guaranteed execution | policy-driven execution |
| perfect MEV protection | protection-enhanced routing |
| always succeeds | reliability-focused delivery |
| private for all paths | route-aware path selection |

This is enforced by the smoke test suite.

---

## Documentation

1. [PRD](.omx/plans/prd-slotflow-mvp.md) -- Product definition, acceptance criteria
2. [Architecture](docs/architecture.md) -- System design, state machine, lifecycle
3. [API Contracts](docs/api-contracts.md) -- SDK, HTTP, receipt schema
4. [Test Spec](.omx/plans/test-spec-slotflow-mvp.md) -- Test strategy, verification criteria
5. [Implementation Plan](docs/implementation-plan.md) -- Build phases, file structure
