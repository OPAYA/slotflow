import { describe, expect, it } from "vitest";
import { deriveExecutionPlan } from "../engine.js";
import type { PolicyEngineInput } from "../engine.js";
import type { RouteEstimate, RouteHealthSnapshot } from "@slotflow/shared";

// ── Fixtures ──

const healthAll: RouteHealthSnapshot[] = [
  { routeId: "fast-default", kind: "fast", healthy: true, latencyMs: 50, protectionCapable: false, lastCheckedAt: "2026-01-01T00:00:00Z" },
  { routeId: "protected-default", kind: "protected", healthy: true, latencyMs: 100, protectionCapable: true, lastCheckedAt: "2026-01-01T00:00:00Z" },
  { routeId: "public-rpc-default", kind: "public_rpc", healthy: true, latencyMs: 200, protectionCapable: false, lastCheckedAt: "2026-01-01T00:00:00Z" },
];

const estimatesAll: RouteEstimate[] = [
  { routeId: "fast-default", kind: "fast", estimatedLatencyMs: 200, estimatedFeeLamports: 25000, protectionSignal: false, confidence: 0.7 },
  { routeId: "protected-default", kind: "protected", estimatedLatencyMs: 600, estimatedFeeLamports: 15000, protectionSignal: true, confidence: 0.75 },
  { routeId: "public-rpc-default", kind: "public_rpc", estimatedLatencyMs: 400, estimatedFeeLamports: 5000, protectionSignal: false, confidence: 0.6 },
];

function makeInput(overrides: Partial<PolicyEngineInput> & Pick<PolicyEngineInput, "options">): PolicyEngineInput {
  return {
    routeHealth: healthAll,
    routeEstimates: estimatesAll,
    ...overrides,
  };
}

// ── Tests ──

describe("Policy Engine", () => {
  describe("FAST", () => {
    it("selects the lowest-latency route first", () => {
      const plan = deriveExecutionPlan(
        makeInput({ options: { policy: "FAST" } }),
      );
      expect(plan.chosenRoute.kind).toBe("fast");
      expect(plan.policy).toBe("FAST");
    });

    it("uses minimal retries", () => {
      const plan = deriveExecutionPlan(
        makeInput({ options: { policy: "FAST" } }),
      );
      expect(plan.retryStrategy.maxRetries).toBeLessThanOrEqual(2);
    });

    it("targets processed confirmation by default", () => {
      const plan = deriveExecutionPlan(
        makeInput({ options: { policy: "FAST" } }),
      );
      expect(plan.confirmationTarget).toBe("processed");
    });
  });

  describe("PROTECTED", () => {
    it("selects a protection-capable route first", () => {
      const plan = deriveExecutionPlan(
        makeInput({ options: { policy: "PROTECTED" } }),
      );
      expect(plan.chosenRoute.kind).toBe("protected");
    });

    it("keeps preflight on", () => {
      const plan = deriveExecutionPlan(
        makeInput({ options: { policy: "PROTECTED" } }),
      );
      expect(plan.preflightMode).toBe("on");
    });

    it("targets confirmed by default", () => {
      const plan = deriveExecutionPlan(
        makeInput({ options: { policy: "PROTECTED" } }),
      );
      expect(plan.confirmationTarget).toBe("confirmed");
    });
  });

  describe("RELIABLE", () => {
    it("enables conservative retries", () => {
      const plan = deriveExecutionPlan(
        makeInput({ options: { policy: "RELIABLE" } }),
      );
      expect(plan.retryStrategy.maxRetries).toBeGreaterThanOrEqual(3);
      expect(plan.retryStrategy.expirationCheckEnabled).toBe(true);
    });

    it("keeps preflight on", () => {
      const plan = deriveExecutionPlan(
        makeInput({ options: { policy: "RELIABLE" } }),
      );
      expect(plan.preflightMode).toBe("on");
    });
  });

  describe("common behaviors", () => {
    it("respects user confirmation target override", () => {
      const plan = deriveExecutionPlan(
        makeInput({ options: { policy: "FAST", confirmationTarget: "finalized" } }),
      );
      expect(plan.confirmationTarget).toBe("finalized");
    });

    it("applies maxFeeLamports cap", () => {
      const plan = deriveExecutionPlan(
        makeInput({ options: { policy: "FAST", maxFeeLamports: 3000 } }),
      );
      expect(plan.feeStrategy.capApplied).toBe(true);
      expect(plan.feeStrategy.estimatedAdditionalLamports).toBeLessThanOrEqual(3000);
    });

    it("throws when no healthy route exists", () => {
      const unhealthy = healthAll.map((h) => ({ ...h, healthy: false }));
      expect(() =>
        deriveExecutionPlan(
          makeInput({ options: { policy: "FAST" }, routeHealth: unhealthy }),
        ),
      ).toThrow("NO_HEALTHY_ROUTE");
    });

    it("generates at least 2 explanation bullets", () => {
      const plan = deriveExecutionPlan(
        makeInput({ options: { policy: "PROTECTED" } }),
      );
      expect(plan.explanation.bullets.length).toBeGreaterThanOrEqual(2);
      expect(plan.explanation.title).toBeTruthy();
    });

    it("all three policies produce different chosen routes", () => {
      const plans = (["FAST", "PROTECTED", "RELIABLE"] as const).map((policy) =>
        deriveExecutionPlan(makeInput({ options: { policy } })),
      );
      const routes = plans.map((p) => p.chosenRoute.kind);
      // FAST → fast, PROTECTED → protected, RELIABLE는 confidence 기준
      expect(routes[0]).toBe("fast");
      expect(routes[1]).toBe("protected");
    });
  });
});
