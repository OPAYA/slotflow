import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SlotFlow Dashboard",
  description: "Policy-driven execution observability",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, sans-serif", background: "#0a0a0f", color: "#e4e4e7" }}>
        <header style={{ padding: "16px 24px", borderBottom: "1px solid #27272a", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em" }}>SlotFlow</span>
          <nav style={{ display: "flex", gap: 16, marginLeft: 32, fontSize: 14 }}>
            <a href="/" style={{ color: "#a1a1aa", textDecoration: "none" }}>Executions</a>
            <a href="/compare" style={{ color: "#a1a1aa", textDecoration: "none" }}>Compare</a>
          </nav>
        </header>
        <main style={{ padding: "24px", maxWidth: 1200, margin: "0 auto" }}>
          {children}
        </main>
      </body>
    </html>
  );
}
