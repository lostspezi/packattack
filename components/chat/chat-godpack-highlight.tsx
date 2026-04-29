import type { ChatGodpackHighlightSummary } from "@/types/chat";

interface ChatGodpackHighlightProps {
  highlight: ChatGodpackHighlightSummary;
  className?: string;
}

/**
 * Render-Treatment für Godpack-System-Messages im Chat. Zeigt alle 5 Karten
 * als horizontale Reihe mit Galaxy-Backdrop. Bewusst kompakter als das
 * Cosmic-Reveal des Glücklichen — der Chat-Eintrag ist die öffentliche
 * Trophäe, nicht die Show.
 */
export function ChatGodpackHighlight({ highlight, className }: ChatGodpackHighlightProps) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-[14px] border border-amber-300/40",
        "p-3",
        className ?? "",
      ].join(" ")}
      style={{
        background:
          "linear-gradient(135deg, rgba(70, 25, 130, 0.55) 0%, rgba(20, 10, 50, 0.78) 55%, rgba(10, 4, 25, 0.85) 100%)",
        boxShadow:
          "0 0 0 1px rgba(255, 200, 80, 0.14), 0 12px 32px rgba(0, 0, 0, 0.45), 0 0 24px rgba(255, 180, 60, 0.18)",
      }}
    >
      {/* Sterne */}
      <div className="pointer-events-none absolute inset-0">
        <span className="absolute left-[8%] top-2 h-1 w-1 rounded-full bg-amber-100/80" />
        <span className="absolute left-[35%] top-1 h-[2px] w-[2px] rounded-full bg-white/85" />
        <span className="absolute left-[62%] top-3 h-1 w-1 rounded-full bg-amber-200/70" />
        <span className="absolute left-[88%] top-1.5 h-[2px] w-[2px] rounded-full bg-white/90" />
        <span className="absolute bottom-2 left-[14%] h-1 w-1 rounded-full bg-amber-300/65" />
        <span className="absolute bottom-1.5 left-[78%] h-[2px] w-[2px] rounded-full bg-white/80" />
      </div>

      <div className="relative">
        <div className="flex items-baseline justify-between gap-2 mb-2.5">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-amber-200 drop-shadow-[0_0_10px_rgba(255,200,80,0.55)]">
            ★ GODPACK ★ {highlight.game}
          </p>
          <p className="text-[11px] font-bold text-amber-200">
            {highlight.totalCoinValue} Coins
          </p>
        </div>

        <p className="text-xs text-white/80 mb-2">
          <span className="font-bold text-white">{highlight.username}</span>
          {" hat 5 Karten gezogen"}
        </p>

        <div className="grid grid-cols-5 gap-1.5">
          {highlight.cards.map((card) => (
            <div
              key={card.cardId}
              className="rounded-[8px] border border-amber-300/25 bg-black/40 p-1"
              title={`${card.name} · ${card.coinValue} Coins`}
            >
              {card.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={card.image}
                  alt={card.name}
                  className="aspect-[63/88] w-full rounded-[5px] object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="aspect-[63/88] w-full rounded-[5px] bg-white/8" />
              )}
              <p className="mt-1 truncate text-center text-[9px] font-semibold text-amber-100">
                {card.coinValue}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
