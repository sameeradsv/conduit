import type { Message } from "@/lib/api";

export interface UIMessage extends Message {
  id: string;
  streaming?: boolean;
}

const PREFIX: Record<string, string> = {
  user:      ">",
  assistant: "~",
  system:    "#",
};

export function MessageRow({ message }: { message: UIMessage }) {
  const { role, content, streaming } = message;
  const isError = content.startsWith("! ");
  const displayRole = isError ? "error" : role === "assistant" ? "ai" : role;
  const prefix = isError ? "!" : (PREFIX[role] ?? "#");

  return (
    <div className={`msg-row ${displayRole}`}>
      <span className={`msg-prefix ${displayRole}`}>{prefix}</span>
      <span className={`msg-body ${displayRole}`}>
        {content}
        {streaming && <span className="stream-cursor" aria-hidden />}
      </span>
    </div>
  );
}
