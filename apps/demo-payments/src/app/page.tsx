"use client";

import { useState, useEffect } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface Receipt {
  receiptId: string;
  policy: string;
  routeKind: string;
  status: string;
  fee: { estimatedAdditionalLamports: number; capApplied: boolean };
  explanation: { title: string; bullets: string[] };
  qualityEstimate: { score: number; label: string };
  timestamps: { createdAt: string; submittedAt?: string; confirmedAt?: string; expiredAt?: string };
  terminalReason?: string;
  attempts: { id: string; routeKind: string; result: string }[];
  events: { id: string; status: string; at: string; reason?: string }[];
}

export default function PaymentDemo() {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(false);

  const executePayment = async () => {
    setLoading(true);
    setReceipt(null);
    try {
      const res = await fetch(`${API}/v1/executions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signedTransaction: btoa(String.fromCharCode(10, 20, 30, 40, 50)),
          options: {
            policy: "RELIABLE",
            appId: "demo-payments",
            confirmationTarget: "confirmed",
            metadata: { flow: "payment", actionGroup: `pay-demo-${Date.now()}`, amount: "25.00", currency: "USDC" },
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

  // Poll for updates
  useEffect(() => {
    if (!receipt || ["finalized", "expired", "failed"].includes(receipt.status)) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API}/v1/executions/${receipt.receiptId}`);
        const data = await res.json();
        setReceipt(data);
      } catch { /* ignore */ }
    }, 2000);
    return () => clearInterval(interval);
  }, [receipt?.receiptId, receipt?.status]);

  const isTerminal = receipt && ["finalized", "expired", "failed"].includes(receipt.status);

  return (
    <div>
      <div style={{ background: "#111116", borderRadius: 10, padding: 24, border: "1px solid #27272a", marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 8px" }}>Send Payment</h2>
        <p style={{ color: "#71717a", fontSize: 13, margin: "0 0 20px" }}>
          Simulates a payment using RELIABLE policy for tracked confirmation and retry management.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: 12, background: "#0a0a0f", borderRadius: 6 }}>
            <span style={{ color: "#71717a" }}>Recipient</span>
            <span style={{ fontFamily: "monospace", fontSize: 12 }}>7xKX...m9Fp</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: 12, background: "#0a0a0f", borderRadius: 6 }}>
            <span style={{ color: "#71717a" }}>Amount</span>
            <span style={{ fontWeight: 600 }}>25.00 USDC</span>
          </div>
        </div>

        <div style={{ padding: 10, background: "#042f2e", borderRadius: 6, fontSize: 12, color: "#06b6d4", marginBottom: 16 }}>
          Policy: RELIABLE — Reliability-focused delivery with tracked confirmation
        </div>

        <button
          onClick={executePayment}
          disabled={loading}
          style={{
            width: "100%",
            padding: 14,
            borderRadius: 8,
            border: "none",
            background: loading ? "#3f3f46" : "#06b6d4",
            color: "white",
            fontSize: 15,
            fontWeight: 600,
            cursor: loading ? "default" : "pointer",
          }}
        >
          {loading ? "Processing..." : "Send Payment"}
        </button>
      </div>

      {receipt && (
        <div style={{ background: "#111116", borderRadius: 10, padding: 24, border: `1px solid ${isTerminal ? "#06b6d433" : "#27272a"}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Payment Receipt</h3>
            {!isTerminal && (
              <span style={{ fontSize: 11, color: "#06b6d4", padding: "3px 8px", background: "#042f2e", borderRadius: 4 }}>
                Tracking...
              </span>
            )}
          </div>

          <Field label="Receipt ID" value={receipt.receiptId} mono />
          <Field label="Status" value={receipt.status} highlight />
          <Field label="Route" value={receipt.routeKind} />
          <Field label="Quality Score" value={String(receipt.qualityEstimate.score)} />
          <Field label="Fee (est.)" value={`${receipt.fee.estimatedAdditionalLamports.toLocaleString()} lamports`} />
          <Field label="Retries" value={String(receipt.attempts.length - 1)} />
          {receipt.terminalReason && <Field label="Terminal Reason" value={receipt.terminalReason} />}

          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#71717a", marginBottom: 8 }}>STATUS TIMELINE</div>
            {receipt.events.map((evt) => (
              <div key={evt.id} style={{ display: "flex", gap: 12, padding: "5px 0", fontSize: 12, borderBottom: "1px solid #1c1c22" }}>
                <span style={{ color: "#52525b", fontFamily: "monospace", fontSize: 11 }}>{new Date(evt.at).toLocaleTimeString()}</span>
                <span style={{ fontWeight: 500 }}>{evt.status}</span>
                {evt.reason && <span style={{ color: "#71717a" }}>— {evt.reason}</span>}
              </div>
            ))}
          </div>

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

function Field({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #1c1c22", fontSize: 13 }}>
      <span style={{ color: "#71717a" }}>{label}</span>
      <span style={{ fontFamily: mono ? "monospace" : "inherit", fontSize: mono ? 11 : 13, fontWeight: highlight ? 600 : 400, color: highlight ? "#06b6d4" : undefined }}>{value}</span>
    </div>
  );
}
