export type AppStatus = "ready" | "streaming" | "error";

interface Props {
  model: string;
  tokenCount: number;
  status: AppStatus;
  mode: string;
}

export function StatusBar({ model, tokenCount, status, mode }: Props) {
  const dotClass =
    status === "streaming" ? "streaming" :
    status === "error"     ? "error"     :
                             "ready";

  const statusLabel =
    status === "streaming" ? "streaming…" :
    status === "error"     ? "connection lost" :
                             "ready";

  return (
    <div className="statusbar">
      <span className="seg">
        <span className="k">model</span>
        <span className="v">{model}</span>
      </span>
      <span className="pipe">│</span>
      <span className="seg">
        <span className="k">tok</span>
        <span className="v">{tokenCount}</span>
      </span>
      <span className="grow" />
      <span className="seg">
        <span className="k">mode</span>
        <span className="v">{mode}</span>
      </span>
      <span className="pipe">│</span>
      <span className="seg">
        <span className={`dot ${dotClass}`} />
        <span className="v">{statusLabel}</span>
      </span>
    </div>
  );
}
