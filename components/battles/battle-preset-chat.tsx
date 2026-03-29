"use client";

import { useState, useRef } from "react";
import { MessageSquare } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PRESET_CHAT_MESSAGES, PRESET_CHAT_COOLDOWN_MS } from "@/lib/battle-constants";

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  messageKey: string;
  text: string;
  createdAt: string;
}

interface BattlePresetChatProps {
  battleId: string;
  messages: ChatMessage[];
  isPlayer: boolean;
  isSpectator: boolean;
  dict: Record<string, string>;
}

const CATEGORY_LABELS: Record<string, string> = {
  hype: "🔥 Hype",
  reaction: "😱 Reaction",
  respect: "🤝 Respect",
  battle: "⚔️ Battle",
  spectator: "🍿 Spectator",
};

export function BattlePresetChat({ battleId, messages, isPlayer, isSpectator, dict }: BattlePresetChatProps) {
  const [cooldown, setCooldown] = useState(false);
  const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lang = typeof window !== "undefined"
    ? (document.documentElement.lang || "en")
    : "en";

  const availableMessages = PRESET_CHAT_MESSAGES.filter(
    (m) => !m.spectatorOnly || isSpectator
  );

  const categories = [...new Set(availableMessages.map((m) => m.category))];

  async function sendMessage(messageKey: string) {
    if (cooldown) return;
    setCooldown(true);
    if (cooldownRef.current) clearTimeout(cooldownRef.current);
    cooldownRef.current = setTimeout(() => setCooldown(false), PRESET_CHAT_COOLDOWN_MS);

    try {
      await fetch(`/api/battles/${battleId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageKey }),
      });
    } catch { /* ignore */ }
  }

  return (
    <Card variant="soft" className="flex flex-col gap-3 p-4 max-h-[600px]">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-text-secondary" />
        <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          {dict.chat || "Chat"}
        </p>
      </div>

      {/* Message feed */}
      <div className="flex-1 overflow-y-auto space-y-1 min-h-[80px] max-h-40">
        {messages.length === 0 ? (
          <p className="text-center text-xs text-text-secondary py-4">
            {dict.noMessages || "No messages yet."}
          </p>
        ) : (
          messages.map((msg) => {
            const preset = PRESET_CHAT_MESSAGES.find((m) => m.key === msg.messageKey);
            const text = preset
              ? (lang === "de" ? preset.de : preset.en)
              : msg.text;

            return (
              <div key={msg.id} className="flex items-start gap-1.5 rounded-[8px] bg-white/3 px-2 py-1.5">
                <span className="shrink-0 text-[10px] font-semibold text-text-secondary max-w-[50px] truncate">
                  {msg.userName.split(" ")[0]}:
                </span>
                <span className="text-[11px] text-text-primary leading-snug">{text}</span>
              </div>
            );
          })
        )}
      </div>

      {/* Preset buttons */}
      {(isPlayer || isSpectator) && (
        <div className="space-y-2 border-t border-border pt-2">
          {categories.map((cat) => (
            <div key={cat}>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                {CATEGORY_LABELS[cat] ?? cat}
              </p>
              <div className="flex flex-wrap gap-1">
                {availableMessages
                  .filter((m) => m.category === cat)
                  .map((m) => (
                    <button
                      key={m.key}
                      onClick={() => sendMessage(m.key)}
                      disabled={cooldown}
                      className={[
                        "rounded-[6px] border border-white/8 bg-white/4 px-2 py-0.5 text-[10px] text-text-primary transition-all",
                        cooldown
                          ? "opacity-40 cursor-not-allowed"
                          : "hover:bg-white/8 hover:border-pa-green/30 cursor-pointer",
                      ].join(" ")}
                    >
                      {lang === "de" ? m.de : m.en}
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
