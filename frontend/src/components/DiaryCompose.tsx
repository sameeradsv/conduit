"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface Props {
  onSend: (text: string) => void;
  onAbort: () => void;
  onBack: () => void;
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

const HOLES = 7;

export function DiaryCompose({ onSend, onAbort, onBack, disabled, streaming }: Props) {
  const [value, setValue] = useState("");
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const submit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || streaming) return;
    setSaveStatus("saving…");
    onSend(trimmed);
    setValue("");
  }, [value, streaming, onSend]);

  useEffect(() => {
    if (!streaming && saveStatus === "saving…") {
      setSaveStatus("saved");
      const t = setTimeout(() => setSaveStatus(null), 3000);
      return () => clearTimeout(t);
    }
  }, [streaming, saveStatus]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        submit();
      }
      if (e.key === "Escape") {
        setValue("");
      }
    },
    [submit],
  );

  return (
    <div className="diary">
      {/* punched holes */}
      <div className="diary-holes" aria-hidden>
        {Array.from({ length: HOLES }).map((_, i) => (
          <div key={i} className="diary-hole" />
        ))}
      </div>

      {/* date header */}
      <div className="diary-head">
        <button className="diary-back" onClick={onBack} aria-label="Exit diary mode">
          ← back
        </button>
        <span className="date">{todayLabel()}</span>
      </div>

      {/* writing surface */}
      <div className="diary-surface ruled">
        <textarea
          ref={textareaRef}
          className="diary-text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            "what happened today…\n\ntasks → circuit  ·  interactions → canopy  ·  meals → chef"
          }
          spellCheck
          autoComplete="off"
          autoCorrect="on"
        />
      </div>

      {/* foot */}
      <div className="diary-foot">
        {streaming ? (
          <span className="save-status">routing entries to apps…</span>
        ) : saveStatus ? (
          <span className="save-status">{saveStatus}</span>
        ) : (
          <span>
            <kbd>Ctrl+Enter</kbd>save · <kbd>Esc</kbd>clear
          </span>
        )}
        {streaming ? (
          <button className="diary-save-btn" onClick={onAbort}>
            stop
          </button>
        ) : (
          <button
            className="diary-save-btn"
            onClick={submit}
            disabled={!value.trim() || disabled}
          >
            save entry
          </button>
        )}
      </div>
    </div>
  );
}
