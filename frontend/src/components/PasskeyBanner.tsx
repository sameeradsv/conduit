"use client";

import { useState } from "react";
import { usePasskey } from "@/hooks/usePasskey";

export function PasskeyBanner() {
  const { supported, registered, registerPasskey } = usePasskey();
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (!supported || registered || dismissed || done) return null;

  async function handleEnable() {
    setBusy(true);
    try {
      await registerPasskey();
      setDone(true);
    } catch {
      setDismissed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        borderBottom: "1px solid var(--rule)",
        background: "var(--bg-1)",
        padding: "5px var(--pad-x)",
        fontSize: "var(--fs-xs)",
        color: "var(--dim)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexShrink: 0,
      }}
    >
      <span style={{ color: "var(--sys)" }}>~</span>
      <span>enable biometric sign-in?</span>
      <button
        onClick={handleEnable}
        disabled={busy}
        style={{
          background: "transparent",
          border: "1px solid var(--rule)",
          color: "var(--ink)",
          padding: "1px 8px",
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: "var(--fs-xs)",
        }}
      >
        {busy ? "…" : "enable"}
      </button>
      <button
        onClick={() => setDismissed(true)}
        style={{
          background: "transparent",
          border: 0,
          color: "var(--dim)",
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: "var(--fs-xs)",
          padding: 0,
        }}
      >
        not now
      </button>
    </div>
  );
}
