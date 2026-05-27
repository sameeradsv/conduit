import type { Message } from "@/lib/api";

export interface UIMessage extends Message {
  id: string;
  streaming?: boolean;
}

const GLYPH: Record<string, string> = {
  user:      ">",
  assistant: "~",
  system:    "#",
};

export function MessageRow({ message }: { message: UIMessage }) {
  const { role, content, streaming } = message;
  const isError = content.startsWith("! ");
  const kind = isError ? "error" : role === "assistant" ? "ai" : role === "user" ? "user" : "sys";
  const glyph = isError ? "!" : (GLYPH[role] ?? "#");

  return (
    <div className={`line ${kind}`}>
      <span className="glyph">{glyph}</span>
      <span className="body">
        {content}
        {streaming && <span className="caret-blink" aria-hidden />}
      </span>
    </div>
  );
}
