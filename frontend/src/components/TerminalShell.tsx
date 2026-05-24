"use client";

import { useState, useRef, useCallback } from "react";
import { MessageFeed } from "./MessageFeed";
import { CommandInput } from "./CommandInput";
import { StatusBar, type AppStatus } from "./StatusBar";
import { ModelPicker } from "./ModelPicker";
import { ThemeToggle } from "./ThemeToggle";
import { streamChat, saveSession, type Message, type ModelId, MODELS } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { UIMessage } from "./MessageRow";

const DEFAULT_SYSTEM = "You are a helpful assistant. Be concise and direct.";

const HELP_TEXT = `conduit — available commands:
  /help              show this message
  /models            list available models
  /model <id>        switch model
  /system <text>     set system prompt
  /clear             clear chat history
  /logout            sign out`;

const MODELS_TEXT =
  "available models:\n" + MODELS.map((m) => `  ${m.id}`).join("\n");

let idCounter = 0;
function uid() { return `m${++idCounter}`; }

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
  const abortRef = useRef<AbortController | null>(null);

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
    [addMsg, addSystem, logout],
  );

  const handleSend = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

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

      // Build API message history (skip system UI messages)
      const history: Message[] = [
        { role: "system", content: systemPrompt },
        ...messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: trimmed },
      ];

      const aiId = addMsg({ role: "assistant", content: "", streaming: true });
      let fullContent = "";
      abortRef.current = new AbortController();

      try {
        for await (const chunk of streamChat(
          history,
          model,
          abortRef.current.signal,
        )) {
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
        // Persist completed exchange — best-effort, never blocks the UI
        saveSession(
          [
            ...history.filter((m) => m.role !== "system"),
            { role: "assistant", content: fullContent },
          ],
          model,
        );
      } catch (err: unknown) {
        const isAbort =
          err instanceof Error && err.name === "AbortError";
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
    [messages, model, systemPrompt, addMsg, handleSlashCommand],
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
        <ThemeToggle />
        {user && (
          <button className="theme-btn" onClick={logout} title="sign out">
            {user.username} ↩
          </button>
        )}
      </div>

      <MessageFeed messages={messages} />

      <CommandInput
        onSend={handleSend}
        onAbort={handleAbort}
        disabled={status === "streaming"}
        streaming={status === "streaming"}
      />

      <StatusBar model={currentModel} tokenCount={tokenCount} status={status} />
    </div>
  );
}
