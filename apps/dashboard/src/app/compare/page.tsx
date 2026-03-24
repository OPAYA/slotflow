"use client";

import { useEffect, useState } from "react";
import { fetchExecutions } from "@/lib/api";
import type { SlotFlowReceipt } from "@/lib/types";

const policyColor: Record<string, string> = {
  FAST: "#f59e0b",
  PROTECTED: "#8b5cf6",
  RELIABLE: "#06b6d4",
};

export default function ComparePage() {
  const [executions, setExecutions] = useState<SlotFlowReceipt[]>([]);

  useEffect(() => {
    fetchExecutions().then(setExecutions).catch(() => {});
    const interval = setInterval(() => {
      fetchExecutions().then(setExecutions).catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Group by policy — latest per policy
  const byPolicy = new Map<string, SlotFlowReceipt>();
  for (const r of executions) {
    if (!byPolicy.has(r.policy)) byPolicy.set(r.policy, r);
  }
  const policies = ["FAST", "PROTECTED", "RELIABLE"];
  const rows = policies.map((p) => byPolicy.get(p)).filter(Boolean) as SlotFlowReceipt[];

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 24 }}>Policy Comparison</h1>

      {rows.length === 0 ? (
        <div style={{ padding: 60, textAlign: "center", color: "#52525b" }}>
          Send transactions with different policies to see a comparison here.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${rows.length}, 1fr)`, gap: 16 }}>
          {rows.map((r) => {
            const landedMs = r.timestamps.landedAt && r.timestamps.submittedAt
              ? new Date(r.timestamps.landedAt).getTime() - new Date(r.timestamps.submittedAt).getTime()
              : null;

            return (
              <div key={r.receiptId} style={{
                background: "#111116",
                borderRadius: 10,
                padding: 24,
                border: `1px solid ${policyColor[r.policy]}33`,
              }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: policyColor[r.policy], marginBottom: 16 }}>
                  {r.policy}
                </div>

                <Metric label="Route" value={r.routeKind ?? "—"} />
                <Metric label="Status" value={r.status} />
                <Metric label="Landed Latency" value={landedMs != null ? `${landedMs}ms` : "pending..."} />
                <Metric label="Est. Fee" value={`${r.fee.estimatedAdditionalLamports.toLocaleString()} lamports`} />
                <Metric label="Retries" value={String(r.attempts.length - 1)} />
                <Metric label="Quality Score" value={String(r.qualityEstimate.score)} />

                <div style={{ marginTop: 16, padding: 12, background: "#0a0a0f", borderRadius: 6, fontSize: 12, color: "#a1a1aa" }}>
                  <div style={{ fontWeight: 600, marginBottom: 6, color: "#e4e4e7" }}>{r.explanation.title}</div>
                  <ul style={{ margin: 0, paddingLeft: 16, lineHeight: 1.7 }}>
                    {r.explanation.bullets.slice(0, 3).map((b, i) => <li key={i}>{b}</li>)}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #1c1c22", fontSize: 13 }}>
      <span style={{ color: "#71717a" }}>{label}</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  );
}
