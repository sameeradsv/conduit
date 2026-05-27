"use client";

import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

type Mode = "conduit" | "cortex";

export default function LoginPage() {
  const { login, loginWithCortex, register, isAuthenticated, loading } =
    useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("cortex");
  const [username, setUsername] = useState("");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && isAuthenticated) router.push("/");
  }, [isAuthenticated, loading, router]);

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
      <div className="login-card">
        {/* corner brackets */}
        <div className="corner tl" />
        <div className="corner tr" />
        <div className="corner bl" />
        <div className="corner br" />

        <h1>conduit</h1>
        <p className="subtitle">terminal ai chat · sign in to continue</p>

        <div className="auth-tabs">
          <button
            className="auth-tab"
            aria-current={mode === "cortex"}
            onClick={() => switchMode("cortex")}
          >
            cortex account
          </button>
          <button
            className="auth-tab"
            aria-current={mode === "conduit"}
            onClick={() => switchMode("conduit")}
          >
            conduit account
          </button>
        </div>

        <label className="field">
          <span>username</span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={onKey}
            autoFocus
            autoComplete="username"
            spellCheck={false}
          />
        </label>

        <label className="field">
          <span>{mode === "cortex" ? "password" : "passcode"}</span>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            onKeyDown={onKey}
            autoComplete="current-password"
          />
        </label>

        {error && <div className="login-error">! {error}</div>}

        <button
          className="submit-btn"
          onClick={() => handle("login")}
          disabled={busy || !username || !secret}
        >
          {busy ? "…" : "sign in"}
        </button>

        {mode === "conduit" && (
          <button
            className="secondary-btn"
            onClick={() => handle("register")}
            disabled={busy || !username || !secret}
          >
            {busy ? "…" : "register"}
          </button>
        )}

        {mode === "cortex" && (
          <p className="login-hint">sign in with your shared cortex account</p>
        )}
      </div>
    </div>
  );
}
