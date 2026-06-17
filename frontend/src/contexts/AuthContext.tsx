"use client";

import { createContext, useCallback, useContext, useEffect } from "react";
import {
  AuthProvider as CortexProvider,
  useAuth as useCortexAuth,
  setAuthToken,
} from "@shared/cortex";
import type { AuthUser } from "@shared/cortex";
import { useRouter, usePathname } from "next/navigation";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
const CORTEX_BASE =
  process.env.NEXT_PUBLIC_CORTEX_URL?.replace(/\/$/, "") ?? "";
const TOKEN_KEY = "conduit_auth_token";

async function callAuth(
  endpoint: string,
  username: string,
  passcode: string,
): Promise<{ token: string; user: AuthUser }> {
  const res = await fetch(`${API_BASE}/auth/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: username.toLowerCase(), passcode }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (username: string, passcode: string) => Promise<void>;
  loginWithCortex: (username: string, password: string) => Promise<void>;
  register: (username: string, passcode: string) => Promise<void>;
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>(null as unknown as AuthContextValue);

function AuthBootScreen() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <div className="brand" style={{ fontSize: "var(--fs-xl)" }}>
          conduit
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="animate-pulse"
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--ink)",
                opacity: 0.55,
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function AuthBridge({ children }: { children: React.ReactNode }) {
  const { user, loading, logout, refetch } = useCortexAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isLogin = pathname?.replace(/\/$/, "") === "/login";

  useEffect(() => {
    if (!loading && !user && !isLogin) router.push("/login");
  }, [user, loading, isLogin, router]);

  const login = useCallback(
    async (username: string, passcode: string) => {
      const data = await callAuth("login", username, passcode);
      setAuthToken(TOKEN_KEY, data.token);
      await refetch();
    },
    [refetch],
  );

  const register = useCallback(
    async (username: string, passcode: string) => {
      const data = await callAuth("register", username, passcode);
      setAuthToken(TOKEN_KEY, data.token);
      await refetch();
    },
    [refetch],
  );

  const loginWithCortex = useCallback(
    async (username: string, password: string) => {
      if (!CORTEX_BASE) throw new Error("Cortex URL not configured");
      const res = await fetch(`${CORTEX_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.toLowerCase(), password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Request failed" }));
        throw new Error(err.detail || "Cortex login failed");
      }
      const data = await res.json();
      setAuthToken(TOKEN_KEY, data.token);
      await refetch();
    },
    [refetch],
  );

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    loginWithCortex,
    register,
    logout,
    refetch,
  };

  let content: React.ReactNode = children;
  if (!isLogin && (loading || !user)) {
    content = <AuthBootScreen />;
  }

  return <AuthContext.Provider value={value}>{content}</AuthContext.Provider>;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <CortexProvider apiBase={API_BASE} tokenKey={TOKEN_KEY} authPath="/auth">
      <AuthBridge>{children}</AuthBridge>
    </CortexProvider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
