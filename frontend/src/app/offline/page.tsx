export default function OfflinePage() {
  return (
    <div className="offline-shell">
      <div>
        <div style={{ color: "var(--accent)", marginBottom: 8 }}>conduit</div>
        <div># connection lost</div>
        <div
          style={{ color: "var(--fg-faint)", marginTop: 4, fontSize: 11 }}
        >
          no network available — check your connection and refresh
        </div>
      </div>
    </div>
  );
}
