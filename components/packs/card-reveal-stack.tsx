"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { type EffectTier, TIER_CONFIGS, getEffectTier } from "./effect-tiers";
import type { ParticleCanvasHandle } from "./particle-canvas";

interface CardData {
  cardId: string;
  name: string;
  rarity: string;
  coinValue: number;
  conversionValue: number;
  image: string | null;
  packIndex: number;
  cardIndex: number;
  status?: string;
}

interface CardRevealStackProps {
  cards: CardData[];
  packCount: number;
  lang: string;
  particleRef: React.RefObject<ParticleCanvasHandle | null>;
  onPlaySound: (key: string, volume?: number) => void;
  onAllRevealed: () => void;
}

const CARD_W = 150;

export function CardRevealStack({
  cards, packCount, lang, particleRef, onPlaySound, onAllRevealed,
}: CardRevealStackProps) {
  const isDe = lang === "de";
  const prefersReducedMotion = useReducedMotion();

  const sortedCards = useMemo(
    () =>
      cards
        .map((card, origIndex) => ({ card, origIndex }))
        .sort((a, b) => a.card.coinValue - b.card.coinValue),
    [cards],
  );

  const [revealedCount, setRevealedCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [lightboxCard, setLightboxCard] = useState<CardData | null>(null);
  const [lightboxTier, setLightboxTier] = useState<EffectTier>(1);
  const [lightboxFlipped, setLightboxFlipped] = useState(false);
  const lightboxCardRef = useRef<HTMLDivElement | null>(null);
  const drawTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const scheduleTimer = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    drawTimersRef.current.push(id);
    return id;
  }, []);

  // Cancel any in-flight draw timers on unmount (e.g. user hits Skip)
  useEffect(() => {
    const timers = drawTimersRef.current;
    return () => {
      timers.forEach(clearTimeout);
      timers.length = 0;
    };
  }, []);

  const allRevealed = revealedCount === sortedCards.length;
  const remaining = sortedCards.length - revealedCount;
  const nextCard = sortedCards[revealedCount]?.card ?? null;
  const revealed = sortedCards.slice(0, revealedCount);

  const fireEffects = useCallback((tier: EffectTier) => {
    const config = TIER_CONFIGS[tier];
    const el = lightboxCardRef.current;
    if (!el || !particleRef.current) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    if (config.particleCount > 0) {
      particleRef.current.emit({
        x: cx, y: cy,
        count: Math.round(config.particleCount * 1.8),
        colors: config.colors,
        speed: [120, 320], size: [3, 9],
        lifetime: [600, 1400], gravity: 60,
        spread: Math.PI * 2, shape: "circle",
      });
    }
    if (config.coinRainParticles) {
      particleRef.current.emit({
        x: cx, y: rect.top - 50,
        count: 40,
        colors: ["#FFD700", "#FFA500", "#FFEC8B"],
        speed: [50, 150], size: [3, 8],
        lifetime: [900, 1800], gravity: 240,
        spread: Math.PI / 2.5, shape: "circle",
      });
    }
    if (config.confetti) {
      particleRef.current.emitConfetti(config.colors, config.confettiCount);
    }
  }, [particleRef]);

  // Fire effects once the Lightbox has committed and the flip starts —
  // guarantees `lightboxCardRef` is attached before we read its bounding rect.
  useEffect(() => {
    if (!lightboxFlipped || !lightboxCard) return;
    fireEffects(lightboxTier);
  }, [lightboxFlipped, lightboxCard, lightboxTier, fireEffects]);

  const handleDraw = useCallback(() => {
    if (busy || allRevealed || !nextCard) return;
    const tier = getEffectTier(nextCard.coinValue);
    const config = TIER_CONFIGS[tier];
    setBusy(true);

    if (tier === 1) {
      onPlaySound(config.soundKey, config.volume);
      scheduleTimer(() => {
        setRevealedCount((c) => c + 1);
        setBusy(false);
      }, 500);
      return;
    }

    // Tier 2+: Lightbox path
    setLightboxCard(nextCard);
    setLightboxTier(tier);
    setLightboxFlipped(false);

    const enterMs = 550;
    const flipMs = config.flipDuration * 1000;
    const extraHoldForProtection = tier >= 4 ? 4000 : 0;
    const holdAfterFlip = 2000 + config.flipPauseMs + extraHoldForProtection;

    scheduleTimer(() => {
      setLightboxFlipped(true);
      onPlaySound(config.soundKey, config.volume);
      if (config.extraSoundKey) {
        onPlaySound(config.extraSoundKey, config.volume * 0.7);
      }
      scheduleTimer(() => {
        setLightboxCard(null);
        setRevealedCount((c) => c + 1);
        setBusy(false);
      }, flipMs + holdAfterFlip);
    }, enterMs);
  }, [busy, allRevealed, nextCard, onPlaySound, scheduleTimer]);

  if (prefersReducedMotion) {
    return (
      <div className="w-full max-w-4xl mx-auto py-4 px-3 space-y-3">
        <p className="text-center text-sm text-text-muted">
          {sortedCards.length} {isDe ? "Karten" : "Cards"}
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2.5">
          {sortedCards.map(({ card, origIndex }) => (
            <CardFront key={origIndex} card={card} tier={getEffectTier(card.coinValue)} />
          ))}
        </div>
        <Button variant="primary" size="lg" className="w-full" onClick={onAllRevealed}>
          {isDe ? "Weiter zur Übersicht" : "Continue to overview"}
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center gap-8 py-6 px-3">
      <div className="text-center">
        <p className="text-sm text-text-muted">
          {revealedCount}/{sortedCards.length} {isDe ? "aufgedeckt" : "revealed"}
          {packCount > 1 && ` · ${packCount} Packs`}
        </p>
        {!allRevealed && remaining > 0 && (
          <p className="text-xs text-text-muted/70 mt-1">
            {isDe ? "Tippe auf den Stapel, um die nächste Karte zu ziehen" : "Tap the deck to draw the next card"}
          </p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-10 sm:gap-20 w-full">
        <div className="flex flex-col items-center gap-3">
          <p className="text-xs uppercase tracking-[2px] text-text-muted/80 font-semibold">
            {isDe ? "Ziehen" : "Draw"}
          </p>
          {!allRevealed ? (
            <UnrevealedStack
              remaining={remaining}
              onClick={handleDraw}
              disabled={busy}
              isDe={isDe}
            />
          ) : (
            <EmptySlot isDe={isDe} variant="empty" />
          )}
        </div>

        <div className="flex flex-col items-center gap-3">
          <p className="text-xs uppercase tracking-[2px] text-text-muted/80 font-semibold">
            {isDe ? "Aufgedeckt" : "Revealed"}
          </p>
          <RevealedPile entries={revealed} />
        </div>
      </div>

      {allRevealed && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.3 }}
          className="w-full max-w-sm"
        >
          <Button variant="primary" size="lg" className="w-full" onClick={onAllRevealed}>
            {isDe ? "Weiter zur Übersicht" : "Continue to overview"}
          </Button>
        </motion.div>
      )}

      <AnimatePresence>
        {lightboxCard && (
          <Lightbox
            card={lightboxCard}
            tier={lightboxTier}
            flipped={lightboxFlipped}
            cardRef={lightboxCardRef}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Unrevealed stack ─────────────────────────────────────────────────

function UnrevealedStack({
  remaining, onClick, disabled, isDe,
}: {
  remaining: number;
  onClick: () => void;
  disabled: boolean;
  isDe: boolean;
}) {
  const layerCount = Math.min(remaining - 1, 4);
  const layers = Array.from({ length: Math.max(0, layerCount) }, (_, i) => i);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="relative group outline-none focus-visible:ring-2 focus-visible:ring-pa-green rounded-xl"
      style={{ width: CARD_W, aspectRatio: "63/88" }}
      aria-label={isDe ? `Nächste Karte ziehen (${remaining} übrig)` : `Draw next card (${remaining} left)`}
    >
      {layers.map((i) => (
        <div
          key={i}
          className="absolute inset-0"
          style={{
            transform: `translate(${(i + 1) * 4}px, ${(i + 1) * 4}px)`,
            zIndex: layers.length - i,
          }}
        >
          <CardBack muted />
        </div>
      ))}
      <motion.div
        className="absolute inset-0"
        style={{ zIndex: layers.length + 2 }}
        animate={disabled ? { y: 0 } : { y: [0, -6, 0] }}
        transition={disabled ? {} : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        whileHover={disabled ? undefined : { scale: 1.04, y: -10 }}
        whileTap={disabled ? undefined : { scale: 0.97 }}
      >
        <CardBack glow={!disabled} />
      </motion.div>
      <div className="absolute -top-2 -right-2 z-[20] bg-pa-green text-black text-[11px] font-bold rounded-full min-w-[28px] h-[28px] px-2 flex items-center justify-center shadow-lg ring-2 ring-black/50 pointer-events-none">
        {remaining}
      </div>
    </button>
  );
}

// ─── Revealed pile ────────────────────────────────────────────────────

function RevealedPile({ entries }: { entries: { card: CardData; origIndex: number }[] }) {
  if (entries.length === 0) {
    return <EmptySlot variant="waiting" />;
  }
  const visibleStart = Math.max(0, entries.length - 5);
  const layers = entries.slice(visibleStart);

  return (
    <div className="relative" style={{ width: CARD_W, aspectRatio: "63/88" }}>
      {layers.map(({ card, origIndex }, i) => {
        const tier = getEffectTier(card.coinValue);
        const config = TIER_CONFIGS[tier];
        const isTop = i === layers.length - 1;
        return (
          <motion.div
            key={origIndex}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 0.7, y: -60, rotate: -8 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
              rotate: 0,
              x: i * 4,
              translateY: i * 4,
            }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            style={{ zIndex: i }}
          >
            <CardFront card={card} tier={tier} />
            {isTop && tier >= 2 && config.glowIntensity > 0 && (
              <div
                className="absolute inset-0 rounded-xl pointer-events-none"
                style={{
                  boxShadow: `0 0 ${config.glowIntensity * 0.6}px ${config.glowColor}`,
                }}
              />
            )}
          </motion.div>
        );
      })}
      {entries.length > layers.length && (
        <div className="absolute -bottom-2 -left-2 z-[20] bg-surface/80 backdrop-blur-sm text-text-primary text-[10px] font-semibold rounded-full px-2 h-5 flex items-center justify-center border border-border pointer-events-none">
          +{entries.length - layers.length}
        </div>
      )}
    </div>
  );
}

// ─── Lightbox overlay ─────────────────────────────────────────────────

type MythicPhase =
  | "idle"
  | "cardLift"
  | "sleeveRise"
  | "cardDescent"
  | "groupLift"
  | "toploaderRise"
  | "groupDescent"
  | "finalCenter";

// Absolute ms offsets from when `flipped && tier >= 4` becomes true.
// Card lifts clear BEFORE the sleeve starts rising, so the sleeve never
// appears to already contain the card during its arrival.
const MYTHIC_TIMELINE: Record<Exclude<MythicPhase, "idle">, number> = {
  cardLift: 1400,
  sleeveRise: 1900,
  cardDescent: 2500,
  groupLift: 3300,
  toploaderRise: 3800,
  groupDescent: 4400,
  finalCenter: 5100,
};

function Lightbox({
  card, tier, flipped, cardRef,
}: {
  card: CardData;
  tier: EffectTier;
  flipped: boolean;
  cardRef: React.RefObject<HTMLDivElement | null>;
}) {
  const config = TIER_CONFIGS[tier];
  const shaking = flipped && config.screenShake;
  const showProtection = tier >= 4;

  // Splash glow — derive RGB base from config.glowColor (rgba(...))
  const colorBase = config.glowColor.replace(/,\s*[\d.]+\)$/, "");
  const splashCore = `${colorBase},0.95)`;
  const splashMid = `${colorBase},0.6)`;
  const splashOuter = `${colorBase},0.2)`;

  // Protection phase driver — schedules phase transitions once flipped
  const [mythicPhase, setMythicPhase] = useState<MythicPhase>("idle");
  useEffect(() => {
    if (!(flipped && showProtection)) return;
    const timers: ReturnType<typeof setTimeout>[] = (
      Object.keys(MYTHIC_TIMELINE) as Array<keyof typeof MYTHIC_TIMELINE>
    ).map((phase) =>
      setTimeout(() => setMythicPhase(phase), MYTHIC_TIMELINE[phase]),
    );
    return () => timers.forEach(clearTimeout);
  }, [flipped, showProtection]);

  // Per-phase animate targets
  // The sleeve rests at y=+60% (below wrapper center) so the card can stay
  // lifted clear of it before descending in. After toploader insertion,
  // everything lifts back to y=0 for the final centered display.
  const cardAnimate =
    mythicPhase === "cardLift" || mythicPhase === "sleeveRise"
      ? { y: "-50%", rotate: 12 }
      : mythicPhase === "cardDescent"
        ? { y: "60%", rotate: 0 }
        : mythicPhase === "groupLift" || mythicPhase === "toploaderRise"
          ? { y: "-50%", rotate: 12 }
          : mythicPhase === "groupDescent"
            ? { y: "60%", rotate: 0 }
            : { y: "0%", rotate: 0 }; // idle, finalCenter

  const sleeveAnimate =
    mythicPhase === "idle" || mythicPhase === "cardLift"
      ? { y: "120%", rotate: 0, opacity: 0 }
      : mythicPhase === "sleeveRise" || mythicPhase === "cardDescent"
        ? { y: "60%", rotate: 0, opacity: 1 }
        : mythicPhase === "groupLift" || mythicPhase === "toploaderRise"
          ? { y: "-50%", rotate: 12, opacity: 1 }
          : mythicPhase === "groupDescent"
            ? { y: "60%", rotate: 0, opacity: 1 }
            : { y: "0%", rotate: 0, opacity: 1 }; // finalCenter

  const toploaderHidden =
    mythicPhase === "idle" ||
    mythicPhase === "cardLift" ||
    mythicPhase === "sleeveRise" ||
    mythicPhase === "cardDescent" ||
    mythicPhase === "groupLift";
  const toploaderAnimate =
    toploaderHidden
      ? { y: "120%", opacity: 0 }
      : mythicPhase === "toploaderRise" || mythicPhase === "groupDescent"
        ? { y: "60%", opacity: 1 }
        : { y: "0%", opacity: 1 }; // finalCenter

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none"
    >
      {/* Base dark backdrop */}
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" />

      {/* Organic SVG splash blob — sits behind card, tinted by tier */}
      {flipped && config.glowIntensity > 0 && (
        <motion.div
          className="absolute pointer-events-none"
          initial={{ opacity: 0, scale: 0.2, rotate: -8 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          exit={{ opacity: 0, scale: 1.15, transition: { duration: 0.5 } }}
          transition={{ type: "spring", stiffness: 130, damping: 14, mass: 0.9 }}
          style={{
            width: "min(85vw, 560px)",
            height: "min(85vw, 560px)",
            left: "50%",
            top: "50%",
            x: "-50%",
            y: "-50%",
            mixBlendMode: "screen",
          }}
        >
          <svg
            viewBox="-280 -280 560 560"
            className="w-full h-full"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <radialGradient id={`splash-grad-${tier}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={splashCore} />
                <stop offset="35%" stopColor={splashMid} />
                <stop offset="75%" stopColor={splashOuter} />
                <stop offset="100%" stopColor={`${colorBase},0)`} />
              </radialGradient>
              <filter id={`splash-blur-${tier}`} x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="6" />
              </filter>
            </defs>
            <path
              d="M 0,-190 C 70,-225 115,-180 150,-195 C 200,-170 225,-120 205,-80 C 255,-50 240,30 200,60 C 240,130 155,180 105,160 C 115,230 10,245 -40,205 C -85,255 -175,215 -170,155 C -240,150 -255,65 -200,20 C -260,-40 -215,-140 -160,-140 C -130,-215 -55,-230 0,-190 Z"
              fill={`url(#splash-grad-${tier})`}
              filter={`url(#splash-blur-${tier})`}
            />
          </svg>
        </motion.div>
      )}

      <motion.div
        initial={{ scale: 0.35, opacity: 0, rotate: -12 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        exit={{ scale: 0.45, opacity: 0, y: 140, transition: { duration: 0.6, ease: "easeIn" } }}
        transition={{ duration: 0.55, ease: [0.34, 1.56, 0.64, 1] }}
        className={`relative ${shaking ? "animate-screen-shake" : ""}`}
        style={{
          width: "min(62vw, 340px)",
          aspectRatio: "63/88",
          perspective: 900,
        }}
      >
        {/* Card + rim glow — for Tier 4+, phase-driven lift & tilt */}
        <motion.div
          className="absolute inset-0"
          animate={showProtection && flipped ? cardAnimate : { y: "0%", rotate: 0 }}
          transition={
            showProtection && flipped
              ? { duration: 0.55, ease: [0.33, 1.15, 0.55, 1] }
              : { duration: 0 }
          }
          style={{ perspective: 900, transformOrigin: "center" }}
        >
          <div
            ref={cardRef}
            style={{
              transformStyle: "preserve-3d",
              transition: `transform ${config.flipDuration}s cubic-bezier(0.4, 0, 0.2, 1)`,
              transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
              width: "100%",
              height: "100%",
              position: "relative",
            }}
          >
            <div style={{ backfaceVisibility: "hidden", position: "absolute", inset: 0 }}>
              <CardBack />
            </div>
            <div style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)", position: "absolute", inset: 0 }}>
              <CardFront card={card} tier={tier} large />
            </div>
          </div>
          {flipped && config.glowIntensity > 0 && (
            <motion.div
              className="absolute inset-0 rounded-xl pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.45, delay: 0.1 }}
              style={{
                boxShadow: `0 0 ${config.glowIntensity * 0.9}px ${config.glowColor}`,
              }}
            />
          )}
        </motion.div>

        {flipped && showProtection && (
          <>
            {/* Penny sleeve — slides in from the right, then joins the card for toploader insertion */}
            <motion.div
              className="absolute pointer-events-none overflow-hidden"
              style={{
                top: "-1.5%",
                left: "-1.2%",
                right: "-1.2%",
                bottom: "-1.2%",
                borderRadius: 14,
                border: "1px solid rgba(200,220,255,0.45)",
                background:
                  "linear-gradient(135deg, rgba(200,220,255,0.03) 0%, rgba(255,255,255,0.12) 30%, rgba(200,220,255,0.03) 70%)",
                boxShadow:
                  "inset 0 1px 2px rgba(255,255,255,0.25), inset 0 -1px 1px rgba(180,200,230,0.15), 0 2px 10px rgba(0,0,0,0.35)",
                transformOrigin: "center",
              }}
              initial={{ y: "120%", rotate: 0, opacity: 0 }}
              animate={sleeveAnimate}
              transition={{
                y: { duration: 0.6, ease: [0.25, 0.9, 0.35, 1] },
                rotate: { duration: 0.55, ease: [0.33, 1.15, 0.55, 1] },
                opacity: { duration: 0.3, ease: "easeOut" },
              }}
            >
              {/* Shine streak — fires when card is fully in sleeve */}
              <motion.div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.55) 50%, transparent 60%)",
                }}
                initial={{ x: "-120%", opacity: 0 }}
                animate={
                  mythicPhase === "finalCenter"
                    ? { x: "120%", opacity: [0, 1, 1, 0] }
                    : { x: "-120%", opacity: 0 }
                }
                transition={{
                  duration: 0.9,
                  times: [0, 0.15, 0.85, 1],
                  ease: "easeInOut",
                }}
              />
            </motion.div>

            {/* Toploader — slides in from the left after sleeved card is resting */}
            <motion.div
              className="absolute pointer-events-none"
              style={{
                top: "-4.5%",
                left: "-3.2%",
                right: "-3.2%",
                bottom: "-4.5%",
                borderRadius: 10,
                border: "3px solid rgba(255,255,255,0.28)",
                boxShadow:
                  "0 0 0 1px rgba(255,255,255,0.15), inset 0 0 0 2px rgba(255,255,255,0.07), 0 10px 28px rgba(0,0,0,0.55), 0 0 24px rgba(255,215,0,0.15)",
                transformOrigin: "center",
              }}
              initial={{ y: "120%", opacity: 0 }}
              animate={toploaderAnimate}
              transition={{
                y: { duration: 0.6, ease: [0.25, 0.9, 0.35, 1] },
                opacity: { duration: 0.3, ease: "easeOut" },
              }}
            >
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  borderRadius: "inherit",
                  background:
                    "linear-gradient(135deg, rgba(255,255,255,0.18) 0%, transparent 18%, transparent 82%, rgba(255,255,255,0.08) 100%)",
                }}
              />
              <div
                className="absolute left-[5%] right-[5%] top-[2px] h-[2px] pointer-events-none"
                style={{
                  background:
                    "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.5) 50%, transparent 100%)",
                  borderRadius: 2,
                }}
              />
            </motion.div>
          </>
        )}
      </motion.div>

      {flipped && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.45 }}
          className="absolute bottom-[10%] left-0 right-0 text-center px-4 pointer-events-none"
        >
          <h2 className="text-xl sm:text-2xl font-bold text-white drop-shadow-lg">
            {card.name}
          </h2>
          <div className="flex items-center justify-center gap-2 mt-1">
            <span className="text-sm text-white/70">{card.rarity}</span>
            <span
              className="text-sm font-bold uppercase tracking-wider"
              style={{ color: config.colors[0] }}
            >
              {config.label}
            </span>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// ─── Shared card parts ────────────────────────────────────────────────

function CardBack({ glow, muted }: { glow?: boolean; muted?: boolean }) {
  const border = glow
    ? "border-pa-green/60 shadow-[0_0_24px_rgba(155,255,0,0.25)]"
    : muted
      ? "border-pa-green/10 opacity-70"
      : "border-pa-green/20";
  return (
    <div className={`aspect-[63/88] w-full rounded-xl overflow-hidden relative border shadow-lg ${border}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/card-back.jpg"
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        draggable={false}
      />
    </div>
  );
}

function CardFront({
  card, tier, large,
}: {
  card: CardData;
  tier: EffectTier;
  large?: boolean;
}) {
  const config = TIER_CONFIGS[tier];
  const showLabel = tier >= 2;
  const nameSize = large ? "text-sm" : "text-[11px]";
  const metaSize = large ? "text-[11px]" : "text-[9px]";

  return (
    <div className="relative w-full h-full">
      {card.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={card.image}
          alt={card.name}
          className="aspect-[63/88] w-full h-full object-cover rounded-xl"
          draggable={false}
        />
      ) : (
        <div className="aspect-[63/88] w-full h-full bg-white/4 rounded-xl flex items-center justify-center border border-border">
          <span className="text-text-muted text-xs">?</span>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 rounded-b-xl bg-gradient-to-t from-black/85 via-black/50 to-transparent px-2 pt-5 pb-2">
        <p className={`font-semibold text-white truncate leading-tight ${nameSize}`}>
          {card.name}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={`text-white/60 ${metaSize}`}>{card.rarity}</span>
          {showLabel && (
            <span
              className={`font-bold uppercase ${metaSize}`}
              style={{ color: config.colors[0] }}
            >
              {config.label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptySlot({ isDe, variant }: { isDe?: boolean; variant: "empty" | "waiting" }) {
  const label = variant === "empty"
    ? (isDe ? "Leer" : "Empty")
    : (isDe ? "Warten" : "Waiting");
  return (
    <div
      className="relative border-2 border-dashed border-border rounded-xl opacity-30 flex items-center justify-center"
      style={{ width: CARD_W, aspectRatio: "63/88" }}
    >
      <span className="text-xs text-text-muted">{label}</span>
    </div>
  );
}
