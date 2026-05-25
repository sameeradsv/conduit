"use client";

import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

type Mode = "conduit" | "cortex";

export default function LoginPage() {
  const { login, loginWithCortex, register, isAuthenticated, loading } =
    useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("conduit");
  const [username, setUsername] = useState("");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && isAuthenticated) router.push("/");
  }, [isAuthenticated, loading, router]);

  // reset fields when switching mode
  const switchMode = (next: Mode) => {
    setMode(next);
    setSecret("");
    setError("");
  };

  const handle = useCallback(
    async (action: "login" | "register") => {
      setError("");
      setBusy(true);
      try {
        if (mode === "cortex") {
          await loginWithCortex(username, secret);
        } else if (action === "login") {
          await login(username, secret);
        } else {
          await register(username, secret);
        }
        router.push("/");
      } catch (e) {
        setError(e instanceof Error ? e.message : "failed");
      } finally {
        setBusy(false);
      }
    },
    [username, secret, mode, login, loginWithCortex, register, router],
  );

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handle("login");
  };

  return (
    <div className="login-shell">
      <div className="login-box">
        <div className="login-title">conduit</div>
        <div className="login-sub">terminal AI chat · sign in to continue</div>

        {/* mode tabs */}
        <div className="login-tabs">
          <button
            className={`login-tab${mode === "conduit" ? " active" : ""}`}
            onClick={() => switchMode("conduit")}
          >
            conduit account
          </button>
          <button
            className={`login-tab${mode === "cortex" ? " active" : ""}`}
            onClick={() => switchMode("cortex")}
          >
            cortex account
          </button>
        </div>

        <div className="login-field">
          <label className="login-label" htmlFor="username">
            username
          </label>
          <input
            id="username"
            className="login-input"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={onKey}
            autoFocus
            autoComplete="username"
            spellCheck={false}
          />
        </div>

        <div className="login-field">
          <label className="login-label" htmlFor="secret">
            {mode === "cortex" ? "password" : "passcode"}
          </label>
          <input
            id="secret"
            className="login-input"
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            onKeyDown={onKey}
            autoComplete="current-password"
          />
        </div>

        {error && <div className="login-error">! {error}</div>}

        <div className="login-actions">
          <button
            className="login-btn primary"
            onClick={() => handle("login")}
            disabled={busy || !username || !secret}
          >
            {busy ? "…" : "[login]"}
          </button>
          {mode === "conduit" && (
            <button
              className="login-btn"
              onClick={() => handle("register")}
              disabled={busy || !username || !secret}
            >
              {busy ? "…" : "[register]"}
            </button>
          )}
        </div>

        {mode === "cortex" && (
          <div className="login-hint">
            sign in with your shared cortex account
          </div>
        )}
      </div>
    </div>
  );
}
