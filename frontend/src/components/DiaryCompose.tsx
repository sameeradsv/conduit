"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface Props {
  onSend: (text: string) => void;
  onAbort: () => void;
  onBack: () => void;
  disabled: boolean;
  streaming: boolean;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function offsetDate(dateStr: string, days: number) {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const HOLES = 7;

export function DiaryCompose({ onSend, onAbort, onBack, disabled, streaming }: Props) {
  const [value, setValue] = useState("");
  const [entryDate, setEntryDate] = useState(todayStr);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const today = todayStr();
  const isPast = entryDate !== today;
  const isToday = entryDate === today;

  const submit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || streaming) return;
    setSaveStatus("saving…");
    const text = isPast
      ? `[Entry for: ${formatDateLabel(entryDate)}]\n\n${trimmed}`
      : trimmed;
    onSend(text);
    setValue("");
  }, [value, streaming, onSend, isPast, entryDate]);

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
        <div className="diary-date-wrap" title="Click to change date">
          <button
            className="diary-nav-btn"
            onClick={() => setEntryDate((d) => offsetDate(d, -1))}
            aria-label="Previous day"
          >
            ‹
          </button>
          <span className={`date${isPast ? " past" : ""}`}>
            {formatDateLabel(entryDate)}
          </span>
          {isPast && <span className="diary-past-badge">past entry</span>}
          <button
            className="diary-nav-btn"
            onClick={() => setEntryDate((d) => offsetDate(d, 1))}
            disabled={isToday}
            aria-label="Next day"
          >
            ›
          </button>
          <input
            ref={dateInputRef}
            type="date"
            className="diary-date-input"
            value={entryDate}
            max={today}
            onChange={(e) => {
              if (e.target.value) setEntryDate(e.target.value);
            }}
            aria-label="Entry date"
          />
        </div>
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
            isPast
              ? `what happened on ${new Date(entryDate + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" })}…`
              : "what happened today…\n\ntasks → circuit  ·  interactions → canopy  ·  meals → chef"
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
