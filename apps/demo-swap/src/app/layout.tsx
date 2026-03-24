export const metadata = { title: "SlotFlow Demo — Swap (PROTECTED)" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#0a0a0f", color: "#e4e4e7" }}>
        <header style={{ padding: "16px 24px", borderBottom: "1px solid #27272a" }}>
          <span style={{ fontSize: 18, fontWeight: 700 }}>SlotFlow Demo</span>
          <span style={{ marginLeft: 12, fontSize: 13, color: "#8b5cf6", fontWeight: 500 }}>Swap (PROTECTED)</span>
        </header>
        <main style={{ padding: 24, maxWidth: 640, margin: "0 auto" }}>{children}</main>
      </body>
    </html>
  );
}
