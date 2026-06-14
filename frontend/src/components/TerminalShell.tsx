"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { MessageFeed } from "./MessageFeed";
import { CommandInput } from "./CommandInput";
import { DiaryCompose } from "./DiaryCompose";
import { StatusBar, type AppStatus } from "./StatusBar";
import { ModelPicker } from "./ModelPicker";
import { ThemeToggle } from "./ThemeToggle";
import { usePasskey } from "@/hooks/usePasskey";
import {
  streamChat,
  streamAgentChat,
  streamWakeup,
  saveSession,
  type Message,
  type ModelId,
  type ConfirmationItem,
  MODELS,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { UIMessage } from "./MessageRow";

type ChatMode = "chat" | "agent" | "diary";

const APP_SCOPES = ["circuit", "canopy", "chef"] as const;
type AppScope = typeof APP_SCOPES[number];

function detectScope(text: string): { scope: AppScope; body: string } | null {
  for (const scope of APP_SCOPES) {
    if (text.toLowerCase().startsWith(`@${scope}`)) {
      return { scope, body: text.slice(scope.length + 1).trim() };
    }
  }
  return null;
}

const DEFAULT_SYSTEM = "You are a helpful assistant. Be concise and direct.";

const HELP_TEXT = `conduit — available commands:
  /help              show this message
  /models            list available models
  /model <id>        switch model
  /system <text>     set system prompt
  /chat              switch to direct chat mode (no tools)
  /agent             toggle agent mode (live data from circuit/canopy/chef)
  /diary             toggle diary mode (log entries silently, no response)
  /digest            fetch a daily briefing from all apps
  /wakeup            ping circuit, canopy, and chef to wake them from idle
  /passkey           enable biometric sign-in on this device
  /clear             clear chat history
  /logout            sign out`;

const MODELS_TEXT =
  "available models:\n" + MODELS.map((m) => `  ${m.id}`).join("\n");

const TOOL_APP: Record<string, string> = {
  create_task: "circuit",
  log_interaction: "canopy",
  log_meal: "chef",
};

function formatConfirmation(results: ConfirmationItem[]): string {
  if (results.length === 0)
    return "~ nothing detected — no tasks, interactions, or meals found in that entry";
  const counts: Record<string, { n: number; ok: boolean; errors: string[] }> = {};
  for (const r of results) {
    if (!counts[r.tool]) counts[r.tool] = { n: 0, ok: true, errors: [] };
    counts[r.tool].n++;
    if (!r.success) {
      counts[r.tool].ok = false;
      if (r.error) counts[r.tool].errors.push(r.error);
    }
  }
  return Object.entries(counts)
    .map(([tool, { n, ok, errors }]) => {
      const app = (TOOL_APP[tool] ?? tool).padEnd(10);
      const line = `${ok ? "✓" : "✗"}  ${app}${tool} × ${n}`;
      return errors.length ? `${line}\n    ! ${errors[0]}` : line;
    })
    .join("\n");
}

let idCounter = 0;
function uid() { return `m${++idCounter}`; }

function loadMode(): ChatMode {
  if (typeof window === "undefined") return "chat";
  const stored = localStorage.getItem("conduit-mode");
  if (stored === "agent" || stored === "diary") return stored;
  if (localStorage.getItem("conduit-agent") === "true") return "agent";
  return "chat";
}

const MODES: { id: ChatMode; label: string; key: string }[] = [
  { id: "chat",  label: "chat",  key: "1" },
  { id: "agent", label: "agent", key: "2" },
  { id: "diary", label: "diary", key: "3" },
];

const MODE_MSGS: Record<ChatMode, string> = {
  chat:  "chat mode — direct LLM, no tools.",
  agent: "agent mode on — circuit, canopy, and chef are available.",
  diary: "diary mode on — write anything and it will be routed silently.\ntasks → circuit · interactions → canopy · meals → chef",
};

export function TerminalShell() {
  const { user, logout } = useAuth();
  const { supported: passkeySupported, registered: passkeyRegistered, registerPasskey } = usePasskey();
  const [messages, setMessages] = useState<UIMessage[]>([
    {
      id: uid(),
      role: "system",
      content: "conduit ready. type a message or /help for commands.",
    },
  ]);
  const [model, setModel] = useState<ModelId>("llama-3.3-70b-versatile");
  const [status, setStatus] = useState<AppStatus>("ready");
  const [tokenCount, setTokenCount] = useState(0);
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM);
  const [chatMode, setChatMode] = useState<ChatMode>(loadMode);
  const [userOpen, setUserOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const uref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userOpen) return;
    const off = (e: PointerEvent) => {
      if (uref.current && !uref.current.contains(e.target as Node)) setUserOpen(false);
    };
    document.addEventListener("pointerdown", off, true);
    return () => document.removeEventListener("pointerdown", off, true);
  }, [userOpen]);

  const setMode = useCallback((mode: ChatMode) => {
    setChatMode(mode);
    localStorage.setItem("conduit-mode", mode);
  }, []);

  const addMsg = useCallback((msg: Omit<UIMessage, "id">): string => {
    const id = uid();
    setMessages((prev) => [...prev, { ...msg, id }]);
    return id;
  }, []);

  const addSystem = useCallback(
    (content: string) => addMsg({ role: "system", content }),
    [addMsg],
  );

  const handleSlashCommand = useCallback(
    (text: string): boolean => {
      const [cmd, ...rest] = text.trim().split(/\s+/);
      switch (cmd) {
        case "/help":
          addSystem(HELP_TEXT);
          return true;
        case "/models":
          addSystem(MODELS_TEXT);
          return true;
        case "/clear":
          setMessages([{ id: uid(), role: "system", content: "chat cleared." }]);
          setTokenCount(0);
          return true;
        case "/chat":
          setMode("chat");
          addSystem("chat mode — direct LLM, no tools.");
          return true;
        case "/agent":
          if (chatMode === "agent") {
            setMode("chat");
            addSystem("agent mode off.");
          } else {
            setMode("agent");
            addSystem("agent mode on — circuit, canopy, and chef are available.");
          }
          return true;
        case "/diary":
          if (chatMode === "diary") {
            setMode("chat");
            addSystem("diary mode off.");
          } else {
            setMode("diary");
            addSystem(MODE_MSGS.diary);
          }
          return true;
        case "/model": {
          const found = MODELS.find((m) => m.id === rest[0]);
          if (found) {
            setModel(found.id);
            addSystem(`model → ${found.id}`);
          } else {
            addMsg({
              role: "system",
              content: `! unknown model: ${rest[0]}. run /models to see options.`,
            });
          }
          return true;
        }
        case "/system": {
          const prompt = rest.join(" ");
          if (prompt) {
            setSystemPrompt(prompt);
            addSystem("system prompt updated.");
          }
          return true;
        }
        case "/logout":
          logout();
          return true;
        default:
          return false;
      }
    },
    [addMsg, addSystem, logout, chatMode, setMode],
  );

  const handleSend = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      if (trimmed === "/wakeup") {
        addSystem("~ pinging circuit, canopy, chef...");
        setStatus("streaming");
        abortRef.current = new AbortController();
        try {
          for await (const event of streamWakeup(abortRef.current.signal)) {
            if ("done" in event && event.done) break;
            const icon = event.ok ? "✓" : "✗";
            addSystem(`${icon}  ${event.app.padEnd(10)}${event.elapsed}s`);
          }
          setStatus("ready");
        } catch (err: unknown) {
          const isAbort = err instanceof Error && err.name === "AbortError";
          if (!isAbort) {
            addSystem(`! ${err instanceof Error ? err.message : "unknown error"}`);
            setStatus("error");
            setTimeout(() => setStatus("ready"), 3000);
          } else {
            setStatus("ready");
          }
        }
        return;
      }

      if (trimmed === "/passkey") {
        if (!passkeySupported) {
          addSystem("! biometric auth not supported on this device.");
          return;
        }
        if (passkeyRegistered) {
          addSystem("~ biometric sign-in already enabled on this device.");
          return;
        }
        addSystem("~ registering passkey...");
        try {
          await registerPasskey();
          addSystem("✓  biometric sign-in enabled.");
        } catch (err: unknown) {
          addSystem(`! ${err instanceof Error ? err.message : "passkey registration failed"}`);
        }
        return;
      }

      if (trimmed === "/digest") {
        const digestPrompt =
          "Daily digest — use your tools to fetch everything and give me a concise briefing: " +
          "my tasks and task summary from Circuit, recent interactions from Canopy, " +
          "today's food log and a meal recommendation from Chef.";

        addSystem("~ fetching daily digest...");
        setStatus("streaming");

        const digestHistory: Message[] = [
          { role: "system", content: systemPrompt },
          { role: "user", content: digestPrompt },
        ];

        const digestId = addMsg({ role: "assistant", content: "", streaming: true });
        let digestContent = "";
        abortRef.current = new AbortController();

        const digestToken =
          typeof window !== "undefined"
            ? localStorage.getItem("conduit_auth_token")
            : null;

        try {
          for await (const chunk of streamAgentChat(
            digestHistory,
            model,
            digestToken,
            abortRef.current.signal,
            (tool) => addSystem(`~ querying ${tool.replace(/_/g, " ")}...`),
          )) {
            digestContent += chunk;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === digestId ? { ...m, content: digestContent } : m,
              ),
            );
            setTokenCount((n) => n + 1);
          }
          setMessages((prev) =>
            prev.map((m) =>
              m.id === digestId ? { ...m, streaming: false } : m,
            ),
          );
          setStatus("ready");
        } catch (err: unknown) {
          const isAbort = err instanceof Error && err.name === "AbortError";
          setMessages((prev) =>
            prev.map((m) =>
              m.id === digestId
                ? {
                    ...m,
                    content: isAbort
                      ? digestContent || "(cancelled)"
                      : `! ${err instanceof Error ? err.message : "unknown error"}`,
                    streaming: false,
                  }
                : m,
            ),
          );
          setStatus(isAbort ? "ready" : "error");
          if (!isAbort) setTimeout(() => setStatus("ready"), 3000);
        }
        return;
      }

      if (trimmed.startsWith("/")) {
        if (!handleSlashCommand(trimmed)) {
          addMsg({
            role: "system",
            content: `! unknown command: ${trimmed}. try /help`,
          });
        }
        return;
      }

      const scoped = detectScope(trimmed);
      if (scoped) {
        addMsg({ role: "user", content: trimmed });
        setStatus("streaming");
        const scopedHistory: Message[] = [
          { role: "system", content: systemPrompt },
          { role: "user", content: scoped.body },
        ];
        const siblingToken =
          typeof window !== "undefined"
            ? localStorage.getItem("conduit_auth_token")
            : null;
        abortRef.current = new AbortController();
        const aiId = addMsg({ role: "assistant", content: "", streaming: true });
        let fullContent = "";
        try {
          for await (const chunk of streamAgentChat(
            scopedHistory,
            model,
            siblingToken,
            abortRef.current.signal,
            (tool) => addSystem(`~ querying ${tool.replace(/_/g, " ")}...`),
            undefined,
            false,
            scoped.scope,
          )) {
            fullContent += chunk;
            setMessages((prev) =>
              prev.map((m) => (m.id === aiId ? { ...m, content: fullContent } : m)),
            );
            setTokenCount((n) => n + 1);
          }
          setMessages((prev) =>
            prev.map((m) => (m.id === aiId ? { ...m, streaming: false } : m)),
          );
          setStatus("ready");
        } catch (err: unknown) {
          const isAbort = err instanceof Error && err.name === "AbortError";
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiId
                ? { ...m, content: isAbort ? fullContent || "(cancelled)" : `! ${err instanceof Error ? err.message : "unknown error"}`, streaming: false }
                : m,
            ),
          );
          setStatus(isAbort ? "ready" : "error");
          if (!isAbort) setTimeout(() => setStatus("ready"), 3000);
        }
        return;
      }

      addMsg({ role: "user", content: trimmed });
      setStatus("streaming");

      const history: Message[] = [
        { role: "system", content: systemPrompt },
        ...messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: trimmed },
      ];

      const siblingToken =
        typeof window !== "undefined"
          ? localStorage.getItem("conduit_auth_token")
          : null;

      abortRef.current = new AbortController();

      if (chatMode === "diary") {
        try {
          for await (const _ of streamAgentChat(
            history,
            model,
            siblingToken,
            abortRef.current.signal,
            undefined,
            (results) => addSystem(formatConfirmation(results)),
            true,
          )) { /* diary mode: no streaming deltas */ }
          setStatus("ready");
        } catch (err: unknown) {
          const isAbort = err instanceof Error && err.name === "AbortError";
          if (!isAbort) {
            addMsg({
              role: "system",
              content: `! ${err instanceof Error ? err.message : "unknown error"}`,
            });
            setStatus("error");
            setTimeout(() => setStatus("ready"), 3000);
          } else {
            setStatus("ready");
          }
        }
        return;
      }

      const aiId = addMsg({ role: "assistant", content: "", streaming: true });
      let fullContent = "";

      const chatStream =
        chatMode === "agent"
          ? streamAgentChat(
              history,
              model,
              siblingToken,
              abortRef.current.signal,
              (tool) => addSystem(`~ querying ${tool.replace(/_/g, " ")}...`),
            )
          : streamChat(history, model, abortRef.current.signal);

      try {
        for await (const chunk of chatStream) {
          fullContent += chunk;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiId ? { ...m, content: fullContent } : m,
            ),
          );
          setTokenCount((n) => n + 1);
        }
        setMessages((prev) =>
          prev.map((m) => (m.id === aiId ? { ...m, streaming: false } : m)),
        );
        setStatus("ready");
        saveSession(
          [
            ...history.filter((m) => m.role !== "system"),
            { role: "assistant", content: fullContent },
          ],
          model,
        );
      } catch (err: unknown) {
        const isAbort = err instanceof Error && err.name === "AbortError";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiId
              ? {
                  ...m,
                  content: isAbort
                    ? fullContent || "(cancelled)"
                    : `! ${err instanceof Error ? err.message : "unknown error"}`,
                  streaming: false,
                }
              : m,
          ),
        );
        setStatus(isAbort ? "ready" : "error");
        if (!isAbort) setTimeout(() => setStatus("ready"), 3000);
      }
    },
    [messages, model, systemPrompt, chatMode, addMsg, addSystem, handleSlashCommand, passkeySupported, passkeyRegistered, registerPasskey],
  );

  const handleAbort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const currentModel = MODELS.find((m) => m.id === model)?.label ?? model;

  return (
    <div className="shell" data-mode={chatMode}>
      {/* topbar — bracket variant */}
      <div className="topbar">
        <span className="brand">conduit</span>
        <span className="topbar-grow" />
        <ThemeToggle />
        <ModelPicker value={model} onChange={setModel} />
        {user && (
          <div className="dropdown" ref={uref}>
            <button className="pill-btn" onClick={() => setUserOpen((o) => !o)}>
              <span className="dim">@</span>{user.username}{" "}
              <span className="caret">▾</span>
            </button>
            {userOpen && (
              <div className="menu">
                <div className="head">─── session ───</div>
                <button
                  onClick={() => {
                    setUserOpen(false);
                    logout();
                  }}
                >
                  <span className="marker" style={{ color: "var(--err)" }}>×</span>
                  logout
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* modebar */}
      <div className="modebar" role="tablist" aria-label="Chat mode">
        {MODES.map((m) => (
          <button
            key={m.id}
            role="tab"
            aria-current={chatMode === m.id}
            className="mode"
            onClick={() => {
              if (chatMode === m.id) return;
              setMode(m.id);
              addSystem(MODE_MSGS[m.id]);
            }}
          >
            <span className="key">⌘{m.key}</span>{m.label}
          </button>
        ))}
        <div className="filler" />
      </div>
      {/* feed — hidden in diary mode via CSS */}
      <MessageFeed messages={messages} />

      {/* composer / diary */}
      {chatMode === "diary" ? (
        <DiaryCompose
          onSend={handleSend}
          onAbort={handleAbort}
          onBack={() => { setMode("chat"); addSystem("diary mode off."); }}
          disabled={status === "streaming"}
          streaming={status === "streaming"}
        />
      ) : (
        <CommandInput
          onSend={handleSend}
          onAbort={handleAbort}
          disabled={status === "streaming"}
          streaming={status === "streaming"}
        />
      )}

      <StatusBar
        model={currentModel}
        tokenCount={tokenCount}
        status={status}
        mode={chatMode}
      />
    </div>
  );
}
