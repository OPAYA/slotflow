"use client";

import { useEffect, useState } from "react";
import { fetchExecutions } from "@/lib/api";
import type { SlotFlowReceipt } from "@/lib/types";

const policyColor: Record<string, string> = {
  FAST: "#f59e0b",
  PROTECTED: "#8b5cf6",
  RELIABLE: "#06b6d4",
};

const statusColor: Record<string, string> = {
  submitted: "#3b82f6",
  processed: "#f59e0b",
  confirmed: "#22c55e",
  finalized: "#10b981",
  expired: "#ef4444",
  failed: "#dc2626",
};

export default function ExecutionsPage() {
  const [executions, setExecutions] = useState<SlotFlowReceipt[]>([]);
  const [filter, setFilter] = useState<string>("");

  useEffect(() => {
    const params: Record<string, string> = {};
    if (filter) params.policy = filter;
    fetchExecutions(params).then(setExecutions).catch(() => {});
    const interval = setInterval(() => {
      fetchExecutions(params).then(setExecutions).catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, [filter]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>Executions</h1>
        <div style={{ display: "flex", gap: 8 }}>
          {["", "FAST", "PROTECTED", "RELIABLE"].map((p) => (
            <button
              key={p}
              onClick={() => setFilter(p)}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                border: filter === p ? "1px solid #6366f1" : "1px solid #3f3f46",
                background: filter === p ? "#1e1b4b" : "transparent",
                color: p ? policyColor[p] : "#e4e4e7",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {p || "All"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #27272a" }}>
              {["Receipt ID", "Policy", "Route", "Status", "Fee (est.)", "Retries", "Created"].map((h) => (
                <th key={h} style={{ padding: "10px 12px", textAlign: "left", color: "#71717a", fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {executions.map((r) => (
              <tr key={r.receiptId} style={{ borderBottom: "1px solid #18181b", cursor: "pointer" }}
                  onClick={() => window.location.href = `/receipt/${r.receiptId}`}>
                <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 12 }}>{r.receiptId}</td>
                <td style={{ padding: "10px 12px" }}>
                  <span style={{ color: policyColor[r.policy], fontWeight: 600 }}>{r.policy}</span>
                </td>
                <td style={{ padding: "10px 12px", color: "#a1a1aa" }}>{r.routeKind}</td>
                <td style={{ padding: "10px 12px" }}>
                  <span style={{ color: statusColor[r.status] ?? "#a1a1aa", fontWeight: 500 }}>{r.status}</span>
                </td>
                <td style={{ padding: "10px 12px", fontFamily: "monospace" }}>{r.fee.estimatedAdditionalLamports.toLocaleString()}</td>
                <td style={{ padding: "10px 12px", textAlign: "center" }}>{r.attempts.length - 1}</td>
                <td style={{ padding: "10px 12px", color: "#71717a", fontSize: 12 }}>{new Date(r.timestamps.createdAt).toLocaleTimeString()}</td>
              </tr>
            ))}
            {executions.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#52525b" }}>No executions yet. Send a transaction to see results here.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
