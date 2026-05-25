"use client";

interface Props {
  active: boolean;
  onToggle: () => void;
}

export function AgentToggle({ active, onToggle }: Props) {
  return (
    <button
      className={`theme-btn${active ? " active" : ""}`}
      onClick={onToggle}
      title={active ? "Agent mode on — querying circuit/canopy/chef" : "Agent mode off — enable to query your apps"}
    >
      [agent]
    </button>
  );
}
