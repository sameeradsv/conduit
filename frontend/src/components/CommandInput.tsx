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
    <div className="composer">
      <div className="input-row">
        <span className="prompt-glyph">&gt;</span>
        <textarea
          ref={textareaRef}
          className="input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
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
          <button className="stop-btn" onClick={onAbort}>
            [stop]
          </button>
        ) : (
          <>
            <span><kbd>↵</kbd>send</span>
            <span><kbd>⇧↵</kbd>newline</span>
            <span><kbd>/</kbd>commands</span>
            <span><kbd>@</kbd>route to app</span>
          </>
        )}
      </div>
    </div>
  );
}
