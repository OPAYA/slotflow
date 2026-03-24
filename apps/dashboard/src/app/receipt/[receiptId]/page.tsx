"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { fetchReceipt } from "@/lib/api";
import type { SlotFlowReceipt } from "@slotflow/shared";

export default function ReceiptDetailPage() {
  const params = useParams();
  const receiptId = params.receiptId as string;
  const [receipt, setReceipt] = useState<SlotFlowReceipt | null>(null);

  useEffect(() => {
    if (!receiptId) return;
    fetchReceipt(receiptId).then(setReceipt).catch(() => {});
    const interval = setInterval(() => {
      fetchReceipt(receiptId).then(setReceipt).catch(() => {});
    }, 2000);
    return () => clearInterval(interval);
  }, [receiptId]);

  if (!receipt) return <div style={{ padding: 40, color: "#52525b" }}>Loading...</div>;

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: "#71717a", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>{title}</h3>
      {children}
    </div>
  );

  const Field = ({ label, value, mono }: { label: string; value?: string | number | null; mono?: boolean }) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #1c1c22" }}>
      <span style={{ color: "#71717a", fontSize: 13 }}>{label}</span>
      <span style={{ fontSize: 13, fontFamily: mono ? "monospace" : "inherit" }}>{value ?? "—"}</span>
    </div>
  );

  return (
    <div>
      <a href="/" style={{ color: "#6366f1", fontSize: 13, textDecoration: "none" }}>&larr; Back to executions</a>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginTop: 12 }}>Receipt {receipt.receiptId}</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 20 }}>
        <div style={{ background: "#111116", borderRadius: 8, padding: 20, border: "1px solid #27272a" }}>
          <Section title="Overview">
            <Field label="Policy" value={receipt.policy} />
            <Field label="Route" value={`${receipt.routeKind} (${receipt.routeId})`} />
            <Field label="Status" value={receipt.status} />
            <Field label="Confirmation Target" value={receipt.confirmationTarget} />
            <Field label="Signature" value={receipt.signature} mono />
            <Field label="Terminal Reason" value={receipt.terminalReason} />
          </Section>

          <Section title="Fee">
            <Field label="Estimated" value={`${receipt.fee.estimatedAdditionalLamports.toLocaleString()} lamports`} mono />
            <Field label="Actual" value={receipt.fee.actualAdditionalLamports != null ? `${receipt.fee.actualAdditionalLamports.toLocaleString()} lamports` : undefined} mono />
            <Field label="CU Limit" value={receipt.fee.computeUnitLimit?.toLocaleString()} mono />
            <Field label="CU Price" value={receipt.fee.computeUnitPriceMicroLamports?.toLocaleString()} mono />
            <Field label="Cap Applied" value={receipt.fee.capApplied ? "Yes" : "No"} />
          </Section>

          <Section title="Quality">
            <Field label="Score" value={receipt.qualityEstimate.score} />
            <Field label="Label" value={receipt.qualityEstimate.label} />
          </Section>
        </div>

        <div style={{ background: "#111116", borderRadius: 8, padding: 20, border: "1px solid #27272a" }}>
          <Section title="Why this route?">
            <p style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>{receipt.explanation.title}</p>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.8, color: "#a1a1aa" }}>
              {receipt.explanation.bullets.map((b, i) => <li key={i}>{b}</li>)}
            </ul>
          </Section>

          <Section title="Timeline">
            {receipt.events.map((evt) => (
              <div key={evt.id} style={{ display: "flex", gap: 12, padding: "6px 0", borderBottom: "1px solid #1c1c22", fontSize: 13 }}>
                <span style={{ color: "#71717a", fontFamily: "monospace", fontSize: 11 }}>{new Date(evt.at).toLocaleTimeString()}</span>
                <span style={{ fontWeight: 500 }}>{evt.status}</span>
                {evt.reason && <span style={{ color: "#71717a" }}>{evt.reason}</span>}
              </div>
            ))}
          </Section>

          <Section title="Attempts">
            {receipt.attempts.map((att) => (
              <div key={att.id} style={{ padding: "8px 0", borderBottom: "1px solid #1c1c22", fontSize: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{att.routeKind} ({att.routeId})</span>
                  <span style={{ color: att.result === "submitted" ? "#22c55e" : "#ef4444" }}>{att.result}</span>
                </div>
                {att.reason && <div style={{ color: "#71717a", fontSize: 12, marginTop: 2 }}>{att.reason}</div>}
              </div>
            ))}
          </Section>

          {receipt.preflight && (
            <Section title="Preflight">
              <Field label="Mode" value={receipt.preflight.mode} />
              <Field label="Passed" value={receipt.preflight.passed != null ? (receipt.preflight.passed ? "Yes" : "No") : undefined} />
              {receipt.preflight.error && <Field label="Error" value={receipt.preflight.error} />}
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}
