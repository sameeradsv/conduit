"use client";

import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const { login, register, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && isAuthenticated) router.push("/");
  }, [isAuthenticated, loading, router]);

  const handle = useCallback(
    async (mode: "login" | "register") => {
      setError("");
      setBusy(true);
      try {
        if (mode === "login") await login(username, passcode);
        else await register(username, passcode);
        router.push("/");
      } catch (e) {
        setError(e instanceof Error ? e.message : "failed");
      } finally {
        setBusy(false);
      }
    },
    [username, passcode, login, register, router],
  );

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handle("login");
  };

  return (
    <div className="login-shell">
      <div className="login-box">
        <div className="login-title">conduit</div>
        <div className="login-sub">terminal AI chat · sign in to continue</div>

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
          <label className="login-label" htmlFor="passcode">
            passcode
          </label>
          <input
            id="passcode"
            className="login-input"
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            onKeyDown={onKey}
            autoComplete="current-password"
          />
        </div>

        {error && <div className="login-error">! {error}</div>}

        <div className="login-actions">
          <button
            className="login-btn primary"
            onClick={() => handle("login")}
            disabled={busy || !username || !passcode}
          >
            {busy ? "…" : "[login]"}
          </button>
          <button
            className="login-btn"
            onClick={() => handle("register")}
            disabled={busy || !username || !passcode}
          >
            {busy ? "…" : "[register]"}
          </button>
        </div>
      </div>
    </div>
  );
}
