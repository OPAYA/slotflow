// ── Dashboard API client ──

import type { SlotFlowReceipt } from "./types.js";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function fetchExecutions(params?: Record<string, string>): Promise<SlotFlowReceipt[]> {
  const qs = params ? `?${new URLSearchParams(params)}` : "";
  const res = await fetch(`${API_BASE}/v1/executions${qs}`, { cache: "no-store" });
  const data = await res.json();
  return data.executions;
}

export async function fetchReceipt(receiptId: string): Promise<SlotFlowReceipt> {
  const res = await fetch(`${API_BASE}/v1/executions/${receiptId}`, { cache: "no-store" });
  return res.json();
}

export interface CompareRow {
  policy: string;
  routeKind?: string;
  landedLatencyMs?: number;
  retryCount: number;
  estimatedAdditionalLamports: number;
  actualAdditionalLamports?: number;
  finalStatus: string;
}

export async function fetchCompare(actionGroup: string): Promise<CompareRow[]> {
  const res = await fetch(`${API_BASE}/v1/metrics/compare?actionGroup=${actionGroup}`, { cache: "no-store" });
  const data = await res.json();
  return data.rows;
}
