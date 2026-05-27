export default function OfflinePage() {
  return (
    <div className="offline-shell">
      <pre style={{ color: "var(--dim)", fontSize: "var(--fs-sm)", lineHeight: 1.1, margin: 0 }}>{`
  ┌─────────────────┐
  │  no connection  │
  └─────────────────┘`}</pre>
      <h2>no connection</h2>
      <p>network unavailable — check your connection and refresh to reconnect</p>
    </div>
  );
}
