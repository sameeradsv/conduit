"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface Props {
  onSend: (text: string) => void;
  onAbort: () => void;
  disabled: boolean;
  streaming: boolean;
}

function todayLabel() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function DiaryCompose({ onSend, onAbort, disabled, streaming }: Props) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const submit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || streaming) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, streaming, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        submit();
      }
      if (e.key === "Escape") {
        setValue("");
        if (textareaRef.current) textareaRef.current.style.height = "auto";
      }
    },
    [submit],
  );

  return (
    <div className="diary-compose">
      <div className="diary-date"># {todayLabel()}</div>
      <textarea
        ref={textareaRef}
        className="diary-field"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          e.target.style.height = "auto";
          e.target.style.height = `${Math.min(e.target.scrollHeight, 300)}px`;
        }}
        onKeyDown={handleKeyDown}
        placeholder={
          "write anything — tasks you completed, meetings you had, meals you ate...\n\n" +
          "tasks → circuit  ·  interactions → canopy  ·  meals → chef\n\n" +
          "Ctrl+Enter to save"
        }
        rows={6}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        disabled={false}
      />
      <div className="diary-footer">
        <span className="diary-hint">
          {streaming ? "routing entries to apps…" : "Ctrl+Enter to save · Esc to clear"}
        </span>
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
            [save]
          </button>
        )}
      </div>
    </div>
  );
}
