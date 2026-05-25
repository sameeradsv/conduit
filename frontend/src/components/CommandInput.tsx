"use client";

import { useRef, useState, useCallback, useEffect } from "react";

interface Props {
  onSend: (text: string) => void;
  onAbort: () => void;
  disabled: boolean;
  streaming: boolean;
  placeholder?: string;
}

export function CommandInput({ onSend, onAbort, disabled, streaming, placeholder }: Props) {
  const [value, setValue] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, [value]);

  const submit = useCallback(() => {
    if (!value.trim()) return;
    setHistory((prev) => [value, ...prev.slice(0, 99)]);
    setHistoryIdx(-1);
    onSend(value);
    setValue("");
  }, [value, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
    [value, historyIdx, history, submit, onSend],
  );

  return (
    <div className="input-area">
      <span className="input-prefix">{streaming ? "~" : ">"}</span>
      <textarea
        ref={textareaRef}
        className="input-field"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={streaming ? "streaming…" : (placeholder ?? "type a message or /help")}
        rows={1}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        disabled={false}
      />
      {streaming ? (
        <button className="send-btn" onClick={onAbort}>
          [stop]
        </button>
      ) : (
        <button
          className="send-btn"
          onClick={submit}
          disabled={!value.trim() || disabled}
        >
          [↵]
        </button>
      )}
    </div>
  );
}
