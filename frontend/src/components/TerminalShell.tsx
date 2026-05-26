"use client";

import { useState, useRef, useCallback } from "react";
import { MessageFeed } from "./MessageFeed";
import { CommandInput } from "./CommandInput";
import { DiaryCompose } from "./DiaryCompose";
import { StatusBar, type AppStatus } from "./StatusBar";
import { ModelPicker } from "./ModelPicker";
import { ThemeToggle } from "./ThemeToggle";
import { AgentToggle } from "./AgentToggle";
import { DiaryToggle } from "./DiaryToggle";
import {
  streamChat,
  streamAgentChat,
  saveSession,
  type Message,
  type ModelId,
  type ConfirmationItem,
  MODELS,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { UIMessage } from "./MessageRow";

type ChatMode = "chat" | "agent" | "diary";

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
  const counts: Record<string, { n: number; ok: boolean }> = {};
  for (const r of results) {
    if (!counts[r.tool]) counts[r.tool] = { n: 0, ok: true };
    counts[r.tool].n++;
    if (!r.success) counts[r.tool].ok = false;
  }
  return Object.entries(counts)
    .map(([tool, { n, ok }]) => {
      const app = (TOOL_APP[tool] ?? tool).padEnd(10);
      return `${ok ? "✓" : "✗"}  ${app}${tool} × ${n}`;
    })
    .join("\n");
}

let idCounter = 0;
function uid() { return `m${++idCounter}`; }

function loadMode(): ChatMode {
  if (typeof window === "undefined") return "chat";
  const stored = localStorage.getItem("conduit-mode");
  if (stored === "agent" || stored === "diary") return stored;
  // migrate legacy conduit-agent flag
  if (localStorage.getItem("conduit-agent") === "true") return "agent";
  return "chat";
}

export function TerminalShell() {
  const { user, logout } = useAuth();
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
  const abortRef = useRef<AbortController | null>(null);

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
            addSystem(
              "diary mode on — write anything and it will be routed silently.\n" +
              "tasks → circuit · interactions → canopy · meals → chef",
            );
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

      // /digest: must be checked before the general slash router
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

      // ── Diary mode: silent write routing, no AI response ─────────
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
          )) { /* no deltas in diary mode */ }
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

      // ── Agent / chat mode: streaming AI response ──────────────────
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
    [messages, model, systemPrompt, chatMode, addMsg, addSystem, handleSlashCommand],
  );

  const handleAbort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const currentModel = MODELS.find((m) => m.id === model)?.label ?? model;

  return (
    <div className="shell">
      <div className="topbar">
        <span className="brand">conduit</span>
        <span className="topbar-sep">·</span>
        <ModelPicker value={model} onChange={setModel} />
        <span className="topbar-grow" />
        <AgentToggle
          active={chatMode === "agent"}
          onToggle={() => setMode(chatMode === "agent" ? "chat" : "agent")}
        />
        <DiaryToggle
          active={chatMode === "diary"}
          onToggle={() => setMode(chatMode === "diary" ? "chat" : "diary")}
        />
        <ThemeToggle />
        {user && (
          <button className="theme-btn" onClick={logout} title="sign out">
            {user.username} ↩
          </button>
        )}
      </div>

      <MessageFeed messages={messages} />

      {chatMode === "diary" ? (
        <DiaryCompose
          onSend={handleSend}
          onAbort={handleAbort}
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

      <StatusBar model={currentModel} tokenCount={tokenCount} status={status} />
    </div>
  );
}
