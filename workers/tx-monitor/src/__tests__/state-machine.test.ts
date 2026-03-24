import { describe, expect, it } from "vitest";
import {
  canTransition,
  transition,
  isTerminal,
  classifyTerminalReason,
} from "../state-machine.js";
import {
  pollOnce,
  type MonitorableExecution,
  type StatusPoller,
} from "../monitor.js";

// ── State Machine ──

describe("State Machine", () => {
  describe("valid transitions", () => {
    const validPaths: [string, string][] = [
      ["accepted", "planned"],
      ["planned", "submitted"],
      ["submitted", "relayed"],
      ["submitted", "processed"],
      ["submitted", "failed"],
      ["submitted", "expired"],
      ["relayed", "processed"],
      ["processed", "confirmed"],
      ["confirmed", "finalized"],
    ];

    it.each(validPaths)("%s → %s is allowed", (from, to) => {
      expect(canTransition(from as any, to as any)).toBe(true);
    });
  });

  describe("invalid transitions", () => {
    const invalidPaths: [string, string][] = [
      ["finalized", "confirmed"],
      ["expired", "submitted"],
      ["failed", "submitted"],
      ["confirmed", "processed"], // backward
      ["accepted", "confirmed"],  // skip
    ];

    it.each(invalidPaths)("%s → %s is blocked", (from, to) => {
      expect(canTransition(from as any, to as any)).toBe(false);
    });
  });

  describe("terminal states", () => {
    it("finalized is terminal", () => expect(isTerminal("finalized")).toBe(true));
    it("expired is terminal", () => expect(isTerminal("expired")).toBe(true));
    it("failed is terminal", () => expect(isTerminal("failed")).toBe(true));
    it("confirmed is not terminal", () => expect(isTerminal("confirmed")).toBe(false));
    it("submitted is not terminal", () => expect(isTerminal("submitted")).toBe(false));
  });

  describe("transition()", () => {
    it("returns ok for valid transition", () => {
      const result = transition("submitted", "processed");
      expect(result.ok).toBe(true);
      expect(result.from).toBe("submitted");
      expect(result.to).toBe("processed");
    });

    it("returns reason for blocked terminal", () => {
      const result = transition("finalized", "confirmed");
      expect(result.ok).toBe(false);
      expect(result.reason).toContain("terminal");
    });

    it("returns reason for disallowed path", () => {
      const result = transition("accepted", "finalized");
      expect(result.ok).toBe(false);
      expect(result.reason).toContain("not allowed");
    });
  });

  describe("classifyTerminalReason", () => {
    it("finalized → finalized", () => {
      expect(classifyTerminalReason("finalized")).toBe("finalized");
    });
    it("expired → blockhash_expired by default", () => {
      expect(classifyTerminalReason("expired")).toBe("blockhash_expired");
    });
    it("expired with retry_exhausted detail", () => {
      expect(classifyTerminalReason("expired", "retry_exhausted")).toBe("retry_exhausted");
    });
    it("failed with preflight detail", () => {
      expect(classifyTerminalReason("failed", "preflight simulation failed")).toBe("preflight_failed");
    });
    it("failed with adapter detail", () => {
      expect(classifyTerminalReason("failed", "adapter timeout")).toBe("adapter_unhealthy");
    });
    it("non-terminal returns undefined", () => {
      expect(classifyTerminalReason("confirmed")).toBeUndefined();
    });
  });
});

// ── Monitor pollOnce ──

describe("Monitor pollOnce", () => {
  function makeExec(overrides?: Partial<MonitorableExecution>): MonitorableExecution {
    return {
      receiptId: "rcpt_test",
      signature: "sig_test",
      currentStatus: "submitted",
      confirmationTarget: "confirmed",
      maxRetries: 3,
      retryCount: 0,
      createdAt: Date.now(),
      ...overrides,
    };
  }

  const mockPoller = (result: Partial<Parameters<StatusPoller["poll"]> extends never ? never : Awaited<ReturnType<StatusPoller["poll"]>>>): StatusPoller => ({
    poll: async () => ({ found: false, ...result }),
  });

  it("returns null when already terminal", async () => {
    const exec = makeExec({ currentStatus: "finalized" });
    const event = await pollOnce(exec, mockPoller({ found: true, commitment: "finalized" }));
    expect(event).toBeNull();
  });

  it("transitions to processed when poll finds processed", async () => {
    const exec = makeExec({ currentStatus: "submitted" });
    const event = await pollOnce(exec, mockPoller({ found: true, commitment: "processed" }));
    expect(event).not.toBeNull();
    expect(event!.to).toBe("processed");
  });

  it("transitions to confirmed when poll finds confirmed", async () => {
    const exec = makeExec({ currentStatus: "processed" });
    const event = await pollOnce(exec, mockPoller({ found: true, commitment: "confirmed" }));
    expect(event).not.toBeNull();
    expect(event!.to).toBe("confirmed");
  });

  it("transitions to failed on poll error", async () => {
    const exec = makeExec({ currentStatus: "submitted" });
    const event = await pollOnce(exec, mockPoller({ found: false, err: "chain_error: tx failed" }));
    expect(event).not.toBeNull();
    expect(event!.to).toBe("failed");
  });

  it("returns null when not yet found", async () => {
    const exec = makeExec({ currentStatus: "submitted" });
    const event = await pollOnce(exec, mockPoller({ found: false }));
    expect(event).toBeNull();
  });

  it("expires when blockhash TTL exceeded and retries exhausted", async () => {
    const exec = makeExec({
      currentStatus: "submitted",
      createdAt: Date.now() - 100_000, // well past TTL
      maxRetries: 2,
      retryCount: 2,
    });
    const event = await pollOnce(exec, mockPoller({ found: false }));
    expect(event).not.toBeNull();
    expect(event!.to).toBe("expired");
  });
});
