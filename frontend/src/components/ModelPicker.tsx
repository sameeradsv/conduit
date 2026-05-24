"use client";

import { MODELS, type ModelId } from "@/lib/api";

interface Props {
  value: ModelId;
  onChange: (m: ModelId) => void;
}

export function ModelPicker({ value, onChange }: Props) {
  return (
    <select
      className="model-select"
      value={value}
      onChange={(e) => onChange(e.target.value as ModelId)}
      title="Select model"
    >
      {MODELS.map((m) => (
        <option key={m.id} value={m.id}>
          {m.label}
        </option>
      ))}
    </select>
  );
}
