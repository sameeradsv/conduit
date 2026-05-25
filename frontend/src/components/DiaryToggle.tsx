"use client";

interface Props {
  active: boolean;
  onToggle: () => void;
}

export function DiaryToggle({ active, onToggle }: Props) {
  return (
    <button
      className={`theme-btn${active ? " active" : ""}`}
      onClick={onToggle}
      title={active ? "Diary mode on — entries are routed silently to circuit/canopy/chef" : "Diary mode off — enable to log entries across apps"}
    >
      [diary]
    </button>
  );
}
