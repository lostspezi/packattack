"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Map, Send, Sparkles, Trash2, X } from "lucide-react";
import { usePacki, type PackiError } from "@/components/packi/packi-provider";
import { PackiMessageBubble } from "@/components/packi/packi-message";
import { useTour } from "@/components/tour/tour-provider";

interface PackiPanelProps {
  className?: string;
}

function errorMessage(err: PackiError): string {
  switch (err.reason) {
    case "rate_limited":
      return "Ich brauch kurz Pause ✨ Morgen wieder!";
    case "anthropic_rate_limited":
      return "Gerade viel los bei mir — versuch's gleich noch mal.";
    case "anthropic_error":
    case "packi_offline":
      return "Bin kurz offline. Probier's in ein paar Minuten nochmal.";
    case "route_not_allowed":
      return "Hier kann ich dir gerade nicht helfen — wechsel auf Packs oder Dashboard.";
    case "too_long":
      return "Das ist mir zu lang. Fass kurz zusammen?";
    case "empty":
      return "Schreib mir was — ich lese mit.";
    case "unauthorized":
      return "Du bist gerade nicht eingeloggt.";
    default:
      return "Irgendwas ist schiefgelaufen. Nochmal?";
  }
}

export function PackiPanel({ className = "" }: PackiPanelProps) {
  const {
    open,
    messages,
    streamingText,
    streaming,
    error,
    remaining,
    closePanel,
    sendMessage,
    clearError,
    clearConversation,
  } = usePacki();
  const { start: startTour, isActive: tourActive } = useTour();

  // Auto-close panel once the tour takes over — they'd overlap otherwise.
  useEffect(() => {
    if (tourActive && open) closePanel();
  }, [tourActive, open, closePanel]);

  const handleRestartTour = useCallback(() => {
    closePanel();
    void startTour();
  }, [closePanel, startTour]);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 100);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, streamingText, open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closePanel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closePanel]);

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const text = draft.trim();
      if (!text || streaming) return;
      setDraft("");
      await sendMessage(text);
    },
    [draft, streaming, sendMessage],
  );

  const isEmpty = useMemo(
    () => messages.length === 0 && !streamingText && !streaming,
    [messages, streamingText, streaming],
  );

  return (
    <div
      inert={!open}
      aria-hidden={!open}
      className={[
        "fixed z-[100]",
        "inset-x-3 bottom-3 h-[min(80vh,640px)] rounded-2xl",
        "sm:inset-auto sm:bottom-24 sm:left-6 sm:h-[560px] sm:w-[380px]",
        "bg-surface border border-border shadow-2xl",
        "flex flex-col",
        "transition-[transform,opacity] duration-300 ease-out",
        open
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-[calc(100%+16px)] opacity-0",
        className,
      ].join(" ")}
      role="dialog"
      aria-label="Packi"
      aria-modal="false"
    >
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-pa-green/15 text-pa-green">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="leading-tight">
            <div className="text-text-primary font-semibold text-sm">Packi</div>
            <div className="text-text-muted text-[11px]">
              dein PACKATTACK-Helper
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleRestartTour}
            className="text-text-muted hover:text-pa-green p-1.5 rounded-md"
            aria-label="Tour neu starten"
            title="Tour neu starten"
          >
            <Map className="h-4 w-4" aria-hidden="true" />
          </button>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={clearConversation}
              className="text-text-muted hover:text-text-secondary p-1.5 rounded-md"
              aria-label="Verlauf leeren"
              title="Verlauf leeren"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            onClick={closePanel}
            className="text-text-muted hover:text-text-secondary p-1.5 rounded-md"
            aria-label="Packi schließen"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-4 space-y-3"
      >
        {isEmpty && (
          <div className="text-center text-text-muted text-sm px-4 py-8">
            <p className="mb-1">Hey! Ich bin Packi ✨</p>
            <p>Frag mich alles zu PackAttack — Packs, Sammlung, Chat, Profil.</p>
          </div>
        )}

        {messages.map((msg) => (
          <PackiMessageBubble
            key={msg.id}
            role={msg.role}
            content={msg.content}
          />
        ))}

        {streaming && streamingText && (
          <PackiMessageBubble
            role="assistant"
            content={streamingText}
            streaming
          />
        )}

        {streaming && !streamingText && (
          <div className="flex gap-1 px-3.5 py-2">
            <span className="h-2 w-2 rounded-full bg-text-muted animate-bounce" />
            <span
              className="h-2 w-2 rounded-full bg-text-muted animate-bounce"
              style={{ animationDelay: "120ms" }}
            />
            <span
              className="h-2 w-2 rounded-full bg-text-muted animate-bounce"
              style={{ animationDelay: "240ms" }}
            />
          </div>
        )}
      </div>

      {error && (
        <div className="mx-3 mb-2 rounded-md border border-error/30 bg-error/8 px-3 py-2 text-xs text-text-primary flex items-start justify-between gap-2">
          <span>{errorMessage(error)}</span>
          <button
            type="button"
            onClick={clearError}
            className="text-text-muted hover:text-text-secondary shrink-0"
            aria-label="Fehler ausblenden"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t border-border px-3 py-3"
      >
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Frag Packi…"
          disabled={streaming}
          maxLength={2000}
          className="flex-1 bg-white/3 border border-white/8 text-text-primary rounded-[10px] px-3 py-2 text-sm outline-none focus:border-pa-green/35 focus:ring-2 focus:ring-pa-green/6 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={streaming || !draft.trim()}
          className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-pa-green text-black disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Senden"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>

      {typeof remaining === "number" && remaining <= 5 && (
        <div className="px-3 pb-2 text-[11px] text-text-muted text-right">
          Noch {remaining} Nachrichten heute
        </div>
      )}
    </div>
  );
}
