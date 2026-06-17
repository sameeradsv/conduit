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
  listSessions,
  getSession,
  deleteSession,
  type Message,
  type ModelId,
  type ConfirmationItem,
  type SavedSession,
  MODELS,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { getToken } from "@/lib/auth";
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
  /sessions          list saved chat sessions (sign in required)
  /passkey           enable biometric sign-in on this device
  /clear             clear chat history
  /logout            sign out`;

const MODELS_TEXT =
  "available models:\n" + MODELS.map((m) => `  ${m.id}`).join("\n");

const TOOL_APP: Record<string, string> = {
  create_task: "circuit",
  update_task: "circuit",
  log_interaction: "canopy",
  create_person: "canopy",
  log_meal: "chef",
  update_meal_entry: "chef",
};

function formatConfirmation(results: ConfirmationItem[]): string {
  if (results.length === 0)
    return "~ nothing detected — no tasks, interactions, or meals found in that entry";
  return results
    .map((r) => {
      const app = (TOOL_APP[r.tool] ?? r.tool).padEnd(10);
      const label = r.summary?.trim() || r.tool;
      const line = `${r.success ? "✓" : "✗"}  ${app}${label}`;
      return r.error ? `${line}\n    ! ${r.error}` : line;
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
  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
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

  useEffect(() => {
    if (!userOpen || !user) return;
    setSessionsLoading(true);
    listSessions()
      .then(setSessions)
      .catch(() => setSessions([]))
      .finally(() => setSessionsLoading(false));
  }, [userOpen, user]);

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

  const resumeSession = useCallback(
    async (id: number) => {
      try {
        const session = await getSession(id);
        const modelId = MODELS.find((m) => m.id === session.model)?.id ?? model;
        setModel(modelId);
        setMessages([
          { id: uid(), role: "system", content: `~ resumed: ${session.title}` },
          ...session.messages
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((m) => ({
              id: uid(),
              role: m.role as Message["role"],
              content: m.content,
            })),
        ]);
        setTokenCount(0);
        setUserOpen(false);
      } catch (err) {
        addSystem(`! ${err instanceof Error ? err.message : "could not load session"}`);
      }
    },
    [addSystem, model],
  );

  const removeSession = useCallback(
    async (id: number) => {
      try {
        await deleteSession(id);
        setSessions((prev) => prev.filter((s) => s.id !== id));
      } catch (err) {
        addSystem(`! ${err instanceof Error ? err.message : "delete failed"}`);
      }
    },
    [addSystem],
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
        case "/sessions": {
          if (!user) {
            addSystem("! sign in to view saved sessions");
            return true;
          }
          listSessions()
            .then((list) => {
              if (list.length === 0) {
                addSystem("~ no saved sessions yet");
                return;
              }
              addSystem(
                "~ saved sessions:\n" +
                  list
                    .map(
                      (s) =>
                        `  #${s.id}  ${s.title.slice(0, 48)}  (${s.created_at.slice(0, 10)})`,
                    )
                    .join("\n") +
                  "\n\n/resume <id> to load · pick from @user menu",
              );
            })
            .catch(() => addSystem("! could not load sessions"));
          return true;
        }
        case "/resume": {
          const id = Number(rest[0]);
          if (!id) {
            addSystem("! usage: /resume <id>");
            return true;
          }
          void resumeSession(id);
          return true;
        }
        default:
          return false;
      }
    },
    [addMsg, addSystem, logout, chatMode, setMode, user, resumeSession],
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
            const auth =
              event.auth_ok === undefined
                ? ""
                : event.auth_ok
                  ? "  auth ok"
                  : "  auth fail";
            addSystem(`${icon}  ${event.app.padEnd(10)}${event.elapsed}s${auth}`);
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

      const siblingToken = getToken();

      abortRef.current = new AbortController();

      if (chatMode === "diary") {
        let diaryConfirmation = "";
        try {
          for await (const _ of streamAgentChat(
            history,
            model,
            siblingToken,
            abortRef.current.signal,
            undefined,
            (results) => {
              diaryConfirmation = formatConfirmation(results);
              addSystem(diaryConfirmation);
            },
            true,
          )) { /* diary mode: no streaming deltas */ }
          setStatus("ready");
          if (diaryConfirmation) {
            saveSession(
              [
                { role: "user", content: trimmed },
                { role: "assistant", content: diaryConfirmation },
              ],
              model,
            );
          }
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
        <div className="topbar-controls">
          <ThemeToggle />
          <ModelPicker value={model} onChange={setModel} />
          {user && (
            <div className="dropdown dropdown-user" ref={uref}>
              <button className="pill-btn pill-btn-user" onClick={() => setUserOpen((o) => !o)}>
                <span className="dim">@</span>{user.username}{" "}
                <span className="caret">▾</span>
              </button>
              {userOpen && (
                <div className="menu" style={{ minWidth: "14rem", maxWidth: "20rem" }}>
                  <div className="head">─── history ───</div>
                  {sessionsLoading && (
                    <div className="head" style={{ borderBottom: "none" }}>loading…</div>
                  )}
                  {!sessionsLoading && sessions.length === 0 && (
                    <div className="head" style={{ borderBottom: "none", fontWeight: 400 }}>
                      no saved chats yet
                    </div>
                  )}
                  {sessions.slice(0, 8).map((s) => (
                    <div key={s.id} style={{ display: "flex", gap: 4, alignItems: "stretch" }}>
                      <button
                        type="button"
                        style={{ flex: 1, textAlign: "left" }}
                        onClick={() => void resumeSession(s.id)}
                        title={s.title}
                      >
                        <span className="marker">›</span>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {s.title.slice(0, 36) || "untitled"}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeSession(s.id)}
                        title="Delete session"
                        style={{ padding: "0 6px", color: "var(--err)" }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <div className="sep" />
                  <div className="head">─── account ───</div>
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
