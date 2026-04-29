"use client";

import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { GODPACK_THEME } from "@/lib/godpack-theme";
import { formatGameLabel } from "@/lib/format-game";
import type { ParticleCanvasHandle } from "./particle-canvas";

interface CosmicCardRevealCard {
  cardId: string;
  name: string;
  rarity: string;
  coinValue: number;
  conversionValue: number;
  image: string | null;
  packIndex: number;
  cardIndex: number;
  isGodpack?: boolean;
  godpackPosition?: number | null;
  status?: string;
}

interface CosmicCardRevealProps {
  cards: CosmicCardRevealCard[];
  game: string;
  totalCoinValue: number;
  lang: string;
  particleRef: React.RefObject<ParticleCanvasHandle | null>;
  onPlaySound: (key: string, volume?: number) => void;
  onAllRevealed: () => void;
  fairnessCommitmentId?: string | null;
}

const FINAL_INTRO_MS = 600;

/**
 * Cosmic Card Reveal — die spezielle Reveal-Sequenz für Godpacks. Anders als
 * der reguläre CardRevealStack:
 *
 *  - Karten werden NACHEINANDER groß im Zentrum gezeigt, nicht alle auf
 *    einem Stapel zum Antippen.
 *  - Pro Karte: Spotlight, Coin-Counter zählt animiert hoch, Particle-Burst,
 *    sound-tier basierend auf Coin-Wert.
 *  - Sortierung von niedrig nach hoch — der teuerste Pull kommt zuletzt
 *    und kriegt die volle Show.
 *  - Tap überspringt zur nächsten Karte; Skip-All springt zum Final-View
 *    mit allen 5 Karten und Total-Coin-Anzeige.
 */
export function CosmicCardReveal({
  cards,
  game,
  totalCoinValue,
  lang,
  particleRef,
  onPlaySound,
  onAllRevealed,
  fairnessCommitmentId,
}: CosmicCardRevealProps) {
  const isDe = lang === "de";
  const sortedCards = useMemo(
    () => [...cards].sort((a, b) => a.coinValue - b.coinValue),
    [cards],
  );
  const [revealIndex, setRevealIndex] = useState(0);
  const [phase, setPhase] = useState<"sequence" | "final">("sequence");
  const burstedRef = useRef<Set<number>>(new Set());

  // Pro-Karte EINMAL Sound + Particle-Burst beim Erscheinen. Kein Auto-
  // Cycle — der User klickt selbst weiter, damit jede Karte in Ruhe
  // angesehen werden kann. burstedRef stellt sicher, dass derselbe Index
  // selbst bei React-StrictMode-Double-Mount nur einmal feuert.
  useEffect(() => {
    if (phase !== "sequence") return;
    if (revealIndex >= sortedCards.length) {
      setPhase("final");
      return;
    }

    const card = sortedCards[revealIndex];
    if (burstedRef.current.has(revealIndex)) return;
    burstedRef.current.add(revealIndex);

    // Sound je Coin-Wert
    const tier =
      card.coinValue >= 400
        ? { primary: "godpackSparkle", aux: "legendary", vol: 0.85 }
        : card.coinValue >= 250
          ? { primary: "shimmer", aux: "chime", vol: 0.75 }
          : { primary: "chime", aux: null, vol: 0.7 };
    onPlaySound(tier.primary, tier.vol);
    if (tier.aux) {
      window.setTimeout(() => onPlaySound(tier.aux, tier.vol * 0.8), 220);
    }

    // Particle-Burst um die Karte (kurz nach dem Card-Enter)
    const burstTimer = window.setTimeout(() => {
      const canvas = particleRef.current;
      if (!canvas) return;
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      canvas.emit({
        x: cx,
        y: cy,
        count: card.coinValue >= 400 ? 70 : card.coinValue >= 250 ? 45 : 28,
        colors: GODPACK_THEME.burstColors,
        speed: [180, 480],
        size: [3, 10],
        lifetime: [600, 1300],
        gravity: 60,
        spread: Math.PI * 2,
        shape: "circle",
      });
      // Goldene Side-Bursts für hochwertige Karten
      if (card.coinValue >= 400) {
        canvas.emit({
          x: cx - 200,
          y: cy,
          count: 20,
          colors: ["#FFD700", "#FFEC8B", "#FFFFFF"],
          speed: [180, 380],
          size: [3, 7],
          lifetime: [800, 1400],
          gravity: 80,
          spread: Math.PI / 2,
          shape: "circle",
        });
        canvas.emit({
          x: cx + 200,
          y: cy,
          count: 20,
          colors: ["#FFD700", "#FFEC8B", "#FFFFFF"],
          speed: [180, 380],
          size: [3, 7],
          lifetime: [800, 1400],
          gravity: 80,
          spread: Math.PI / 2,
          shape: "circle",
        });
      }
    }, 320);

    return () => window.clearTimeout(burstTimer);
  }, [revealIndex, phase, sortedCards, onPlaySound, particleRef]);

  // Klick weiter — User-getrieben, kein Auto-Timer
  const handleAdvance = useCallback(() => {
    if (phase !== "sequence") return;
    setRevealIndex((i) => i + 1);
  }, [phase]);

  // Skip-All Button — direkt zum Final-View
  const handleSkipAll = useCallback(() => {
    setPhase("final");
  }, []);

  if (phase === "final") {
    return (
      <CosmicFinalView
        cards={sortedCards}
        game={game}
        totalCoinValue={totalCoinValue}
        lang={lang}
        particleRef={particleRef}
        onPlaySound={onPlaySound}
        onContinue={onAllRevealed}
        fairnessCommitmentId={fairnessCommitmentId}
      />
    );
  }

  const current = sortedCards[revealIndex];
  if (!current) return null;

  const tier = current.coinValue >= 400 ? "epic" : current.coinValue >= 250 ? "rare" : "solid";

  return (
    <div
      className="relative w-full min-h-screen flex flex-col items-center justify-center cursor-pointer select-none"
      onClick={handleAdvance}
    >
      {/* Gold-Halo hinter der Karte */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          width: 700,
          height: 700,
          borderRadius: "50%",
          background: GODPACK_THEME.haloGradient,
          filter: "blur(36px)",
        }}
        animate={{ scale: [0.9, 1.05, 1.0] }}
        transition={{ duration: 3.6, ease: "easeInOut", repeat: Infinity }}
      />

      {/* Rotierende Goldstrahlen für hohe Tiers */}
      {tier !== "solid" && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute"
          style={{ width: 800, height: 800 }}
          animate={{ rotate: 360 }}
          transition={{ duration: 18, ease: "linear", repeat: Infinity }}
        >
          <svg viewBox="0 0 800 800" className="w-full h-full">
            {Array.from({ length: tier === "epic" ? 16 : 12 }).map((_, i) => {
              const angle = (i * 360) / (tier === "epic" ? 16 : 12);
              return (
                <polygon
                  key={i}
                  points="400,400 393,40 407,40"
                  fill="rgba(255, 215, 95, 0.3)"
                  transform={`rotate(${angle} 400 400)`}
                />
              );
            })}
          </svg>
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={`${current.cardId}-${revealIndex}`}
          className="relative z-10 flex flex-col items-center"
          initial={{ scale: 0.5, opacity: 0, y: -40, rotateY: -15 }}
          animate={{ scale: 1, opacity: 1, y: 0, rotateY: 0 }}
          exit={{ scale: 0.88, opacity: 0, y: -28, transition: { duration: 0.32 } }}
          transition={{
            duration: 0.9,
            ease: [0.22, 1.2, 0.36, 1],
          }}
        >
          {/* Position-Tag oben */}
          <p
            className="text-[10px] uppercase tracking-[6px] font-bold mb-3 text-amber-200/85"
            style={{ textShadow: "0 0 10px rgba(255,200,80,0.55)" }}
          >
            Karte {revealIndex + 1} / {sortedCards.length}
          </p>

          {/* Die Karte */}
          <CosmicCardFrame card={current} tier={tier} />

          {/* Coin-Counter — animiert hochzählend */}
          <CoinCounter
            target={current.coinValue}
            durationMs={Math.min(1700, 1100 + current.coinValue * 0.9)}
            tier={tier}
          />

          {/* Card-Name + Rarity */}
          <p
            className="mt-3 text-2xl sm:text-3xl font-bold text-white"
            style={{
              textShadow:
                "0 0 18px rgba(255,200,80,0.65), 0 3px 0 rgba(120,35,10,0.55), 0 6px 14px rgba(0,0,0,0.5)",
            }}
          >
            {current.name}
          </p>
          <p
            className="text-xs uppercase tracking-[5px] font-bold text-amber-300/85 mt-1"
            style={{ textShadow: "0 0 10px rgba(255,140,60,0.5)" }}
          >
            {current.rarity}
          </p>
        </motion.div>
      </AnimatePresence>

      {/* Tap to continue hint + Skip All */}
      <div className="absolute bottom-12 left-0 right-0 flex flex-col items-center gap-3 pointer-events-none">
        <p
          className="text-[10px] uppercase tracking-[5px] font-semibold text-white/55 pointer-events-none"
        >
          {isDe ? "Tippe für die nächste Karte" : "Tap for the next card"}
        </p>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleSkipAll();
          }}
          className="pointer-events-auto text-[10px] uppercase tracking-[3px] font-bold text-amber-300/70 hover:text-amber-200 transition-colors"
        >
          {isDe ? "Alle überspringen" : "Skip all"}
        </button>
      </div>
    </div>
  );
}

function CosmicCardFrame({
  card,
  tier,
}: {
  card: CosmicCardRevealCard;
  tier: "solid" | "rare" | "epic";
}) {
  const tierGlow =
    tier === "epic"
      ? "0 0 60px rgba(255,200,80,0.85), 0 0 120px rgba(255,150,80,0.55)"
      : tier === "rare"
        ? "0 0 36px rgba(255,200,80,0.65), 0 0 72px rgba(255,150,80,0.35)"
        : "0 0 24px rgba(255,200,80,0.45)";

  const tierBorder =
    tier === "epic"
      ? "3px solid rgba(255,215,95,0.95)"
      : tier === "rare"
        ? "2.5px solid rgba(255,215,95,0.75)"
        : "2px solid rgba(255,215,95,0.55)";

  // Wrap-Hierarchie: outer = relative + sichtbares Overflow für das
  // Tier-Ribbon, inner = der eigentliche Frame mit overflow:hidden für
  // die Bild-Rundung. Das Ribbon hängt am outer und wird nicht abgeschnitten.
  return (
    <div
      className="relative"
      style={{
        width: "min(70vw, 320px)",
        aspectRatio: "63/88",
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          borderRadius: 14,
          border: tierBorder,
          boxShadow: tierGlow,
          background: GODPACK_THEME.deepCrimson,
          overflow: "hidden",
        }}
      >
        {card.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.image}
            alt={card.name}
            className="absolute inset-0 w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-amber-300/55 text-2xl font-black">
            ?
          </div>
        )}

        {/* Innerer Glanz-Streifen */}
        <motion.div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(105deg, transparent 38%, rgba(255,255,255,0.55) 49%, rgba(255,240,180,0.45) 51%, transparent 62%)",
            mixBlendMode: "screen",
          }}
          initial={{ x: "-110%" }}
          animate={{ x: "110%" }}
          transition={{
            duration: 1.1,
            delay: 0.55,
            ease: "easeInOut",
          }}
        />
      </div>

      {/* Tier-Ribbon — außerhalb des overflow:hidden-Frames, dadurch
          ragt es sauber unter die Karte. */}
      {tier !== "solid" && (
        <motion.div
          className="absolute left-1/2 -translate-x-1/2 px-3 py-1 rounded-full whitespace-nowrap z-10"
          style={{
            bottom: -14,
            background:
              "linear-gradient(135deg, #FFD700 0%, #FFA500 60%, #c46100 100%)",
            color: "#1a0408",
            fontWeight: 900,
            fontSize: 11,
            letterSpacing: "2px",
            textTransform: "uppercase",
            boxShadow:
              "0 0 18px rgba(255,200,80,0.85), 0 3px 0 rgba(120,35,10,0.5)",
          }}
          initial={{ scale: 0, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.45, ease: [0.34, 1.65, 0.5, 1] }}
        >
          {tier === "epic" ? "★ MYTHIC ★" : "★ RARE ★"}
        </motion.div>
      )}
    </div>
  );
}

function CoinCounter({
  target,
  durationMs,
  tier,
}: {
  target: number;
  durationMs: number;
  tier: "solid" | "rare" | "epic";
}) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    setValue(0);
    const start = performance.now();
    let frame = 0;
    function tick(now: number) {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  const sizeClass =
    tier === "epic"
      ? "text-[44px] sm:text-[56px]"
      : tier === "rare"
        ? "text-[36px] sm:text-[44px]"
        : "text-[28px] sm:text-[36px]";

  return (
    <motion.div
      className={`mt-6 font-black ${sizeClass}`}
      style={{
        background:
          "linear-gradient(180deg, #fff7c2 0%, #ffd700 40%, #ff8a00 85%, #b54a00 100%)",
        backgroundClip: "text",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        filter:
          "drop-shadow(0 0 18px rgba(255, 200, 80, 0.85)) drop-shadow(0 4px 0 rgba(120, 45, 0, 0.5))",
        fontFamily: "'Impact', 'Arial Black', sans-serif",
        letterSpacing: "-0.02em",
      }}
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 0.4, duration: 0.4 }}
    >
      {value.toLocaleString("de-DE")}{" "}
      <span className="text-base font-bold uppercase tracking-[3px] align-middle">
        Coins
      </span>
    </motion.div>
  );
}

function CosmicFinalView({
  cards,
  game,
  totalCoinValue,
  lang,
  particleRef,
  onPlaySound,
  onContinue,
  fairnessCommitmentId,
}: {
  cards: CosmicCardRevealCard[];
  game: string;
  totalCoinValue: number;
  lang: string;
  particleRef: React.RefObject<ParticleCanvasHandle | null>;
  onPlaySound: (key: string, volume?: number) => void;
  onContinue: () => void;
  fairnessCommitmentId?: string | null;
}) {
  const isDe = lang === "de";
  const gameLabel = formatGameLabel(game).toUpperCase();
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    onPlaySound("godpackFanfare", 0.85);
    onPlaySound("chime", 0.7);
    window.setTimeout(() => onPlaySound("godpackSparkle", 0.65), 350);
    const canvas = particleRef.current;
    if (canvas) {
      canvas.emitConfetti(GODPACK_THEME.confettiColors, 80);
      window.setTimeout(
        () => canvas.emitConfetti(GODPACK_THEME.confettiColors, 50),
        700,
      );
    }
  }, [onPlaySound, particleRef]);

  return (
    <motion.div
      className="relative w-full min-h-screen flex flex-col items-center justify-center px-4 py-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: FINAL_INTRO_MS / 1000 }}
    >
      {/* Backdrop-Halo */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          width: 1100,
          height: 700,
          borderRadius: "50%",
          background: GODPACK_THEME.haloGradient,
          filter: "blur(40px)",
        }}
        animate={{ scale: [0.95, 1.05, 0.97] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative z-10 flex flex-col items-center gap-4">
        <motion.p
          className="text-[10px] uppercase tracking-[7px] font-bold text-amber-300"
          style={{ textShadow: "0 0 12px rgba(255,180,60,0.65)" }}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
        >
          ★ GODPACK × {gameLabel} ★
        </motion.p>

        <motion.h2
          className="text-[28px] sm:text-[36px] font-black text-white text-center"
          style={{
            textShadow:
              "0 0 24px rgba(255,200,80,0.85), 0 4px 0 rgba(120,35,10,0.5), 0 8px 16px rgba(0,0,0,0.5)",
            fontFamily: "'Impact', 'Arial Black', sans-serif",
            letterSpacing: "-0.01em",
          }}
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.45 }}
        >
          {isDe ? "DEINE LEGENDÄREN 5" : "YOUR LEGENDARY 5"}
        </motion.h2>

        {/* 5er-Kartenreihe */}
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
          {cards.map((card, i) => (
            <motion.div
              key={card.cardId}
              initial={{ opacity: 0, scale: 0.7, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{
                delay: 0.3 + i * 0.08,
                duration: 0.5,
                ease: [0.25, 1.5, 0.5, 1],
              }}
              className="relative"
              style={{
                width: "min(34vw, 130px)",
                aspectRatio: "63/88",
                borderRadius: 10,
                border:
                  card.coinValue >= 400
                    ? "2.5px solid rgba(255,215,95,0.95)"
                    : "1.5px solid rgba(255,215,95,0.55)",
                boxShadow:
                  card.coinValue >= 400
                    ? "0 0 28px rgba(255,200,80,0.7)"
                    : "0 0 14px rgba(255,200,80,0.4)",
                overflow: "hidden",
                background: GODPACK_THEME.deepCrimson,
              }}
            >
              {card.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={card.image}
                  alt={card.name}
                  className="absolute inset-0 w-full h-full object-cover"
                  draggable={false}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-amber-300/60 text-xl font-black">
                  ?
                </div>
              )}
              <div
                className="absolute inset-x-0 bottom-0 px-1.5 py-1 text-center"
                style={{
                  background:
                    "linear-gradient(0deg, rgba(0,0,0,0.85) 0%, transparent 100%)",
                }}
              >
                <p className="text-[10px] font-bold text-amber-200 leading-tight truncate">
                  {card.name}
                </p>
                <p className="text-[10px] font-extrabold text-white">
                  {card.coinValue.toLocaleString("de-DE")} Coins
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Total Coin-Wert */}
        <motion.div
          className="mt-6 flex flex-col items-center"
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.85, duration: 0.55 }}
        >
          <p
            className="text-[10px] uppercase tracking-[6px] font-bold text-amber-200/85"
            style={{ textShadow: "0 0 10px rgba(255,180,60,0.55)" }}
          >
            {isDe ? "Gesamtwert" : "Total worth"}
          </p>
          <p
            className="text-[42px] sm:text-[60px] font-black mt-1"
            style={{
              background:
                "linear-gradient(180deg, #fff7c2 0%, #ffd700 40%, #ff8a00 85%, #b54a00 100%)",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              filter:
                "drop-shadow(0 0 22px rgba(255, 200, 80, 0.85)) drop-shadow(0 4px 0 rgba(120, 45, 0, 0.5))",
              fontFamily: "'Impact', 'Arial Black', sans-serif",
              letterSpacing: "-0.02em",
            }}
          >
            {totalCoinValue.toLocaleString("de-DE")} Coins
          </p>
        </motion.div>

        {/* Continue + Provably-Fair-Link */}
        <motion.div
          className="mt-4 flex flex-col items-center gap-2 w-full max-w-sm"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1, duration: 0.4 }}
        >
          {fairnessCommitmentId && (
            <a
              href={`/${lang}/provably-fair/verify?commitmentId=${fairnessCommitmentId}`}
              className="block text-center text-amber-300/85 text-xs underline decoration-dotted hover:text-amber-200"
            >
              {isDe
                ? "Pull nachrechnen (Provably Fair)"
                : "Verify this pull (Provably Fair)"}
            </a>
          )}
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={onContinue}
          >
            {isDe ? "Weiter zur Übersicht" : "Continue"}
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}
