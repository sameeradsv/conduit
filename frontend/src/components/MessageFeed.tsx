"use client";

import { useEffect, useRef } from "react";
import { MessageRow, type UIMessage } from "./MessageRow";

export function MessageFeed({ messages }: { messages: UIMessage[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="feed">
      {messages.map((msg) => (
        <MessageRow key={msg.id} message={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
