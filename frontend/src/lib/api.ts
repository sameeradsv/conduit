import { getToken } from "./auth";

const _API = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
const apiUrl = (path: string) => (_API ? `${_API}${path}` : path);

function authHeaders(json = false): HeadersInit {
  const headers: Record<string, string> = {};
  if (json) headers["Content-Type"] = "application/json";
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

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
      headers: authHeaders(true),
      body: JSON.stringify({ messages, model }),
    });
  } catch {
    // history save is best-effort — never break the chat
  }
}

export async function listSessions(): Promise<SavedSession[]> {
  try {
    const res = await fetch(apiUrl("/api/history"), {
      headers: authHeaders(),
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function getSession(id: number): Promise<SavedSession> {
  const res = await fetch(apiUrl(`/api/history/${id}`), {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function deleteSession(id: number): Promise<void> {
  const res = await fetch(apiUrl(`/api/history/${id}`), {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
}

export interface Message {
  role: Role;
  content: string;
}

export type ModelId = string;

export interface ModelEntry {
  id: string;
  label: string;
}

export const DEFAULT_MODEL: ModelId = "llama-3.3-70b-versatile";

// Minimal bootstrap list shown before the live fetch completes.
export const BOOTSTRAP_MODELS: ModelEntry[] = [
  { id: "llama-3.3-70b-versatile", label: "llama-3.3-70b" },
  { id: "llama-3.1-8b-instant",    label: "llama-3.1-8b-instant" },
];

export async function fetchModels(): Promise<ModelEntry[]> {
  try {
    const res = await fetch(apiUrl("/api/models"), { headers: authHeaders() });
    if (!res.ok) return BOOTSTRAP_MODELS;
    const data: { models: { id: string; label: string }[] } = await res.json();
    return data.models.length ? data.models.map((m) => ({ id: m.id, label: m.label })) : BOOTSTRAP_MODELS;
  } catch {
    return BOOTSTRAP_MODELS;
  }
}

export interface ConfirmationItem {
  tool: string;
  success: boolean;
  error?: string | null;
  summary?: string;
}

export type WakeupEvent =
  | { app: string; ok: boolean; elapsed: number; auth_ok?: boolean; done?: never }
  | { done: true; app?: never };

export async function* streamWakeup(signal?: AbortSignal): AsyncGenerator<WakeupEvent> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(apiUrl("/api/wakeup"), { signal, headers });
  if (!res.ok) throw new Error(`wakeup failed: HTTP ${res.status}`);
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        yield JSON.parse(line.slice(6)) as WakeupEvent;
      } catch {
        // skip malformed lines
      }
    }
  }
}

export async function* streamAgentChat(
  messages: Message[],
  model: ModelId,
  siblingToken: string | null,
  signal?: AbortSignal,
  onToolCall?: (tool: string) => void,
  onConfirmation?: (results: ConfirmationItem[]) => void,
  diary?: boolean,
  scope?: string,
): AsyncGenerator<string> {
  const res = await fetch(apiUrl("/api/agent/chat"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, model, sibling_token: siblingToken, diary: diary ?? false, scope }),
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
