import type { ChatHighlightCardSummary } from "@/types/chat";

interface ChatJackpotCardProps {
  card: ChatHighlightCardSummary;
  className?: string;
}

function rarityLabel(value?: string | null) {
  if (!value) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function ChatJackpotCard({ card, className }: ChatJackpotCardProps) {
  const rarity = rarityLabel(card.rarity);

  return (
    <div
      className={[
        "relative overflow-hidden rounded-[14px] border border-yellow-400/35",
        "bg-gradient-to-br from-yellow-500/20 via-orange-500/12 to-pa-green/15",
        "p-3 shadow-[0_0_20px_rgba(250,204,21,0.18)] animate-chat-jackpot-burst",
        className ?? "",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-0">
        <span className="animate-chat-jackpot-spark absolute left-[12%] top-2 h-1.5 w-1.5 rounded-full bg-yellow-200 [animation-delay:0ms]" />
        <span className="animate-chat-jackpot-spark absolute left-[70%] top-1 h-1.5 w-1.5 rounded-full bg-orange-300 [animation-delay:140ms]" />
        <span className="animate-chat-jackpot-spark absolute left-[86%] top-6 h-1.5 w-1.5 rounded-full bg-yellow-300 [animation-delay:260ms]" />
        <span className="animate-chat-jackpot-spark absolute bottom-2 left-[18%] h-1.5 w-1.5 rounded-full bg-amber-300 [animation-delay:340ms]" />
      </div>

      <div className="relative flex items-center gap-3">
        <div className="w-16 shrink-0 rounded-[10px] border border-yellow-300/35 bg-black/25 p-1">
          {card.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={card.image}
              alt={card.name}
              className="aspect-[63/88] w-full rounded-[8px] object-cover"
              loading="lazy"
            />
          ) : (
            <div className="aspect-[63/88] w-full rounded-[8px] bg-white/10" />
          )}
        </div>

        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-yellow-200">
            JACKPOT • {card.coinValue} Coins
          </p>
          <p className="mt-1 break-words text-sm font-semibold text-text-primary">{card.name}</p>
          {rarity ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-yellow-300/30 bg-yellow-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-yellow-200">
                {rarity}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
