"use client";

import { useRef, useState, useCallback, useEffect } from "react";

interface Props {
  onSend: (text: string) => void | Promise<boolean | void>;
  onAbort: () => void;
  disabled: boolean;
  streaming: boolean;
  placeholder?: string;
}

const SLASH_COMMANDS = [
  { cmd: "/help",           desc: "show available commands" },
  { cmd: "/models",         desc: "list available models" },
  { cmd: "/model ",         desc: "switch model  e.g. /model llama-3.1-8b-instant" },
  { cmd: "/system ",        desc: "set system prompt" },
  { cmd: "/chat",           desc: "switch to direct chat mode" },
  { cmd: "/agent",          desc: "toggle agent mode (circuit · canopy · chef)" },
  { cmd: "/diary",          desc: "toggle diary mode (silent routing)" },
  { cmd: "/digest",         desc: "fetch daily briefing from all apps" },
  { cmd: "/wakeup",         desc: "ping circuit, canopy, chef to wake from idle" },
  { cmd: "/sessions",       desc: "list saved chat sessions" },
  { cmd: "/resume ",        desc: "resume a saved session  e.g. /resume 12" },
  { cmd: "/passkey",        desc: "enable biometric sign-in on this device" },
  { cmd: "/clear",          desc: "clear chat history" },
  { cmd: "/logout",         desc: "sign out" },
] as const;

export function CommandInput({ onSend, onAbort, disabled, streaming, placeholder }: Props) {
  const [value, setValue] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [suggIdx, setSuggIdx] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, [value]);

  const suggestions = value.startsWith("/")
    ? SLASH_COMMANDS.filter((c) => c.cmd.startsWith(value) || value === "/")
    : [];

  const hasSugg = suggestions.length > 0;

  const submit = useCallback(() => {
    if (!value.trim() || disabled || streaming) return;
    setHistory((prev) => [value, ...prev.slice(0, 99)]);
    setHistoryIdx(-1);
    onSend(value);
    setValue("");
  }, [value, disabled, streaming, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (hasSugg) {
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSuggIdx((i) => Math.max(0, i - 1));
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSuggIdx((i) => Math.min(suggestions.length - 1, i + 1));
          return;
        }
        if (e.key === "Tab") {
          e.preventDefault();
          const chosen = suggestions[suggIdx]?.cmd ?? suggestions[0]?.cmd;
          if (chosen) setValue(chosen);
          setSuggIdx(0);
          return;
        }
        if (e.key === "Enter") {
          const chosen = suggestions[suggIdx]?.cmd ?? suggestions[0]?.cmd;
          // Only intercept if the value isn't already the chosen command —
          // if it already matches, fall through so Enter submits normally.
          if (chosen && chosen.trim() !== value.trim()) {
            e.preventDefault();
            setValue(chosen);
            setSuggIdx(0);
            return;
          }
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setValue("");
          return;
        }
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submit();
        return;
      }
      if (e.key === "ArrowUp" && !value) {
        e.preventDefault();
        const next = Math.min(historyIdx + 1, history.length - 1);
        setHistoryIdx(next);
        setValue(history[next] ?? "");
        return;
      }
      if (e.key === "ArrowDown" && historyIdx >= 0) {
        e.preventDefault();
        const next = historyIdx - 1;
        setHistoryIdx(next);
        setValue(next < 0 ? "" : history[next]);
        return;
      }
      if (e.ctrlKey && e.key === "l") {
        e.preventDefault();
        onSend("/clear");
        return;
      }
    },
    [value, historyIdx, history, submit, onSend, hasSugg, suggestions, suggIdx],
  );

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    setSuggIdx(0);
  }, []);

  return (
    <div className="composer">
      {hasSugg && (
        <ul className="slash-menu" role="listbox">
          {suggestions.map((s, i) => (
            <li
              key={s.cmd}
              role="option"
              aria-selected={i === suggIdx}
              className={i === suggIdx ? "active" : ""}
              onPointerDown={(e) => {
                e.preventDefault();
                setValue(s.cmd);
                setSuggIdx(0);
                textareaRef.current?.focus();
              }}
            >
              <span className="slash-cmd">{s.cmd.trimEnd()}</span>
              <span className="slash-desc">{s.desc}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="input-row">
        <span className="prompt-glyph">&gt;</span>
        <textarea
          ref={textareaRef}
          className="input"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          aria-disabled={disabled}
          placeholder={
            streaming
              ? "streaming…"
              : (placeholder ?? "ask anything · type / for commands · @app to route")
          }
          rows={1}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
        />
      </div>
      <div className="helprow">
        {streaming ? (
          <button type="button" className="stop-btn" onClick={onAbort}>
            [stop]
          </button>
        ) : (
          <>
            <span><kbd>↵</kbd>send</span>
            <span><kbd>⇧↵</kbd>newline</span>
            <span><kbd>/</kbd>commands</span>
            <span><kbd>@</kbd>route to app</span>
            <span><kbd>↑↓</kbd>history</span>
          </>
        )}
      </div>
    </div>
  );
}
