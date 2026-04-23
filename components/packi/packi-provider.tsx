"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

export interface PackiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface PackiError {
  reason: string;
  retryAfterSeconds?: number;
}

interface PackiContextValue {
  open: boolean;
  messages: PackiMessage[];
  streamingText: string;
  streaming: boolean;
  error: PackiError | null;
  remaining: number | null;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  sendMessage: (text: string) => Promise<void>;
  clearError: () => void;
  clearConversation: () => void;
}

const PackiContext = createContext<PackiContextValue | null>(null);

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface SseFrame {
  event: string;
  data: string;
}

function* parseSseFrames(buffer: string): Generator<SseFrame, string> {
  const chunks = buffer.split("\n\n");
  // Last chunk may be incomplete; caller keeps it as the new buffer.
  const complete = chunks.slice(0, -1);
  for (const chunk of complete) {
    if (!chunk.trim()) continue;
    let event = "message";
    const dataLines: string[] = [];
    for (const line of chunk.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
    }
    if (dataLines.length === 0) continue;
    yield { event, data: dataLines.join("\n") };
  }
  return chunks[chunks.length - 1] ?? "";
}

interface PackiProviderProps {
  children: ReactNode;
}

export function PackiProvider({ children }: PackiProviderProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<PackiMessage[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<PackiError | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const inflight = useRef<AbortController | null>(null);

  const openPanel = useCallback(() => setOpen(true), []);
  const closePanel = useCallback(() => setOpen(false), []);
  const togglePanel = useCallback(() => setOpen((v) => !v), []);
  const clearError = useCallback(() => setError(null), []);
  const clearConversation = useCallback(() => {
    inflight.current?.abort();
    inflight.current = null;
    setMessages([]);
    setStreamingText("");
    setStreaming(false);
    setError(null);
  }, []);

  const sendMessage = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text) return;
      if (streaming) return;

      const userMessage: PackiMessage = {
        id: generateId(),
        role: "user",
        content: text,
      };
      setMessages((prev) => [...prev, userMessage]);
      setStreamingText("");
      setStreaming(true);
      setError(null);

      const controller = new AbortController();
      inflight.current?.abort();
      inflight.current = controller;

      let collected = "";
      let gotDone = false;

      try {
        const response = await fetch("/api/packi/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, route: pathname }),
          signal: controller.signal,
        });

        if (!response.ok) {
          let body: Record<string, unknown> = {};
          try {
            body = (await response.json()) as Record<string, unknown>;
          } catch {
            // ignore parse failure — error below is generic enough
          }
          setError({
            reason: (body.error as string) ?? `http_${response.status}`,
            retryAfterSeconds:
              typeof body.retryAfterSeconds === "number"
                ? body.retryAfterSeconds
                : undefined,
          });
          setStreaming(false);
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          setError({ reason: "no_body" });
          setStreaming(false);
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const iter = parseSseFrames(buffer);
          let next = iter.next();
          while (!next.done) {
            const frame = next.value;
            if (frame.event === "token") {
              try {
                const token = JSON.parse(frame.data) as string;
                collected += token;
                setStreamingText(collected);
              } catch {
                collected += frame.data;
                setStreamingText(collected);
              }
            } else if (frame.event === "meta") {
              try {
                const parsed = JSON.parse(frame.data) as {
                  remaining?: number;
                };
                if (typeof parsed.remaining === "number") {
                  setRemaining(parsed.remaining);
                }
              } catch {
                // ignore malformed meta
              }
            } else if (frame.event === "done") {
              gotDone = true;
            } else if (frame.event === "error") {
              try {
                const parsed = JSON.parse(frame.data) as PackiError;
                setError(parsed);
              } catch {
                setError({ reason: "stream_error" });
              }
            }
            next = iter.next();
          }
          buffer = next.value ?? "";
        }

        if (gotDone && collected.trim()) {
          const assistant: PackiMessage = {
            id: generateId(),
            role: "assistant",
            content: collected,
          };
          setMessages((prev) => [...prev, assistant]);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // user navigated or closed — do not surface as error
        } else {
          setError({ reason: "network" });
        }
      } finally {
        setStreamingText("");
        setStreaming(false);
        if (inflight.current === controller) {
          inflight.current = null;
        }
      }
    },
    [pathname, streaming],
  );

  const value = useMemo<PackiContextValue>(
    () => ({
      open,
      messages,
      streamingText,
      streaming,
      error,
      remaining,
      openPanel,
      closePanel,
      togglePanel,
      sendMessage,
      clearError,
      clearConversation,
    }),
    [
      open,
      messages,
      streamingText,
      streaming,
      error,
      remaining,
      openPanel,
      closePanel,
      togglePanel,
      sendMessage,
      clearError,
      clearConversation,
    ],
  );

  return <PackiContext.Provider value={value}>{children}</PackiContext.Provider>;
}

export function usePacki(): PackiContextValue {
  const ctx = useContext(PackiContext);
  if (!ctx) {
    throw new Error("usePacki must be used within <PackiProvider>");
  }
  return ctx;
}
