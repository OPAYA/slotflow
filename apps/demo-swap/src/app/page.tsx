"use client";

import { useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface Receipt {
  receiptId: string;
  policy: string;
  routeKind: string;
  status: string;
  fee: { estimatedAdditionalLamports: number; capApplied: boolean };
  explanation: { title: string; bullets: string[] };
  qualityEstimate: { score: number; label: string };
  preflight?: { mode: string; passed?: boolean };
}

export default function SwapDemo() {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(false);

  const executeSwap = async () => {
    setLoading(true);
    setReceipt(null);
    try {
      // dummy signed tx (base64 of 3 bytes)
      const res = await fetch(`${API}/v1/executions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signedTransaction: btoa(String.fromCharCode(1, 2, 3, 4, 5)),
          options: {
            policy: "PROTECTED",
            appId: "demo-swap",
            maxFeeLamports: 50000,
            confirmationTarget: "confirmed",
            metadata: { flow: "swap", actionGroup: `swap-demo-${Date.now()}` },
          },
        }),
      });
      const data = await res.json();
      setReceipt(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ background: "#111116", borderRadius: 10, padding: 24, border: "1px solid #27272a", marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 8px" }}>Token Swap</h2>
        <p style={{ color: "#71717a", fontSize: 13, margin: "0 0 20px" }}>
          Simulates a DEX swap using PROTECTED policy for protection-enhanced execution.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: 12, background: "#0a0a0f", borderRadius: 6 }}>
            <span style={{ color: "#71717a" }}>From</span>
            <span style={{ fontWeight: 500 }}>1.0 SOL</span>
          </div>
          <div style={{ textAlign: "center", color: "#52525b" }}>&darr;</div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: 12, background: "#0a0a0f", borderRadius: 6 }}>
            <span style={{ color: "#71717a" }}>To</span>
            <span style={{ fontWeight: 500 }}>~142.5 USDC</span>
          </div>
        </div>

        <div style={{ padding: 10, background: "#1e1b4b", borderRadius: 6, fontSize: 12, color: "#8b5cf6", marginBottom: 16 }}>
          Policy: PROTECTED — Protection-enhanced route requested
        </div>

        <button
          onClick={executeSwap}
          disabled={loading}
          style={{
            width: "100%",
            padding: 14,
            borderRadius: 8,
            border: "none",
            background: loading ? "#3f3f46" : "#8b5cf6",
            color: "white",
            fontSize: 15,
            fontWeight: 600,
            cursor: loading ? "default" : "pointer",
          }}
        >
          {loading ? "Executing..." : "Swap with Protection"}
        </button>
      </div>

      {receipt && (
        <div style={{ background: "#111116", borderRadius: 10, padding: 24, border: "1px solid #8b5cf633" }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 16px" }}>Execution Receipt</h3>

          <Field label="Receipt ID" value={receipt.receiptId} mono />
          <Field label="Policy" value={receipt.policy} />
          <Field label="Route" value={receipt.routeKind} />
          <Field label="Status" value={receipt.status} />
          <Field label="Quality Score" value={String(receipt.qualityEstimate.score)} />
          <Field label="Fee (est.)" value={`${receipt.fee.estimatedAdditionalLamports.toLocaleString()} lamports`} />
          <Field label="Fee Cap Applied" value={receipt.fee.capApplied ? "Yes" : "No"} />
          {receipt.preflight && <Field label="Preflight" value={`${receipt.preflight.mode}${receipt.preflight.passed != null ? ` (${receipt.preflight.passed ? "passed" : "failed"})` : ""}`} />}

          <div style={{ marginTop: 16, padding: 12, background: "#0a0a0f", borderRadius: 6 }}>
            <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 6 }}>{receipt.explanation.title}</div>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: "#a1a1aa", lineHeight: 1.7 }}>
              {receipt.explanation.bullets.map((b, i) => <li key={i}>{b}</li>)}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #1c1c22", fontSize: 13 }}>
      <span style={{ color: "#71717a" }}>{label}</span>
      <span style={{ fontFamily: mono ? "monospace" : "inherit", fontSize: mono ? 11 : 13 }}>{value}</span>
    </div>
  );
}
