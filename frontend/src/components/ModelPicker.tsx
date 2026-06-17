"use client";

import { useState, useRef, useEffect } from "react";
import { MODELS, type ModelId } from "@/lib/api";

interface Props {
  value: ModelId;
  onChange: (m: ModelId) => void;
}

export function ModelPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = MODELS.find((m) => m.id === value);

  useEffect(() => {
    if (!open) return;
    const off = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", off, true);
    return () => document.removeEventListener("pointerdown", off, true);
  }, [open]);

  return (
    <div className="dropdown dropdown-model" ref={ref}>
      <button className="pill-btn" onClick={() => setOpen((o) => !o)}>
        <span className="dim">model:</span> {current?.label ?? value}{" "}
        <span className="caret">▾</span>
      </button>
      {open && (
        <div className="menu">
          <div className="head">─── models ───</div>
          {MODELS.map((m) => (
            <button
              key={m.id}
              aria-current={m.id === value}
              onClick={() => {
                onChange(m.id);
                setOpen(false);
              }}
            >
              <span className="marker">{m.id === value ? "●" : "○"}</span>
              <span style={{ flex: 1 }}>{m.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
