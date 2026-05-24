export type AppStatus = "ready" | "streaming" | "error";

interface Props {
  model: string;
  tokenCount: number;
  status: AppStatus;
}

export function StatusBar({ model, tokenCount, status }: Props) {
  const statusLabel =
    status === "streaming" ? "● streaming" :
    status === "error"     ? "● error"     :
                             "● ready";

  return (
    <div className="statusbar">
      <span>{model}</span>
      <span className="sep">·</span>
      <span>{tokenCount} tok</span>
      <span className="sep">·</span>
      <span className={`s-${status}`}>{statusLabel}</span>
    </div>
  );
}
