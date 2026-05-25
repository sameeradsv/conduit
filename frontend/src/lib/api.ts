const _API = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
const apiUrl = (path: string) => (_API ? `${_API}${path}` : path);

export type Role = "user" | "assistant" | "system";

export interface SavedSession {
  id: number;
  model: string;
  title: string;
  created_at: string;
  messages: { role: Role; content: string; created_at: string }[];
}

export async function saveSession(
  messages: Message[],
  model: ModelId,
): Promise<void> {
  try {
    await fetch(apiUrl("/api/history"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, model }),
    });
  } catch {
    // history save is best-effort — never break the chat
  }
}

export async function listSessions(): Promise<SavedSession[]> {
  try {
    const res = await fetch(apiUrl("/api/history"));
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export interface Message {
  role: Role;
  content: string;
}

export const MODELS = [
  { id: "llama-3.3-70b-versatile", label: "llama-3.3-70b" },
  { id: "llama-3.1-8b-instant",    label: "llama-3.1-8b-instant" },
  { id: "mixtral-8x7b-32768",      label: "mixtral-8x7b" },
  { id: "gemma2-9b-it",            label: "gemma2-9b" },
] as const;

export type ModelId = (typeof MODELS)[number]["id"];

export interface ConfirmationItem {
  tool: string;
  success: boolean;
}

export async function* streamAgentChat(
  messages: Message[],
  model: ModelId,
  siblingToken: string | null,
  signal?: AbortSignal,
  onToolCall?: (tool: string) => void,
  onConfirmation?: (results: ConfirmationItem[]) => void,
  diary?: boolean,
): AsyncGenerator<string> {
  const res = await fetch(apiUrl("/api/agent/chat"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, model, sibling_token: siblingToken, diary: diary ?? false }),
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (raw === "[DONE]") return;
      try {
        const parsed = JSON.parse(raw) as {
          delta?: string;
          error?: string;
          status?: string;
          tool?: string;
          confirmation?: ConfirmationItem[];
        };
        if (parsed.error) throw new Error(parsed.error);
        if (parsed.status === "calling_tool" && parsed.tool) {
          onToolCall?.(parsed.tool);
          continue;
        }
        if (parsed.confirmation !== undefined) {
          onConfirmation?.(parsed.confirmation);
          continue;
        }
        if (parsed.delta) yield parsed.delta;
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }
}

export async function* streamChat(
  messages: Message[],
  model: ModelId,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const res = await fetch(apiUrl("/api/chat"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, model }),
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (raw === "[DONE]") return;
      try {
        const parsed = JSON.parse(raw) as { delta?: string; error?: string };
        if (parsed.error) throw new Error(parsed.error);
        if (parsed.delta) yield parsed.delta;
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }
}
