"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { Volume2, VolumeX, SkipForward } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { Pack3D } from "./pack-3d";
import { PackRipper } from "./pack-ripper";
import { CardRevealStack } from "./card-reveal-stack";
import { GodpackIntro } from "./godpack-intro";
import { suppressPendingGuard, notifyPendingPulls } from "./pending-pulls-guard";
import { ParticleCanvas, type ParticleCanvasHandle } from "./particle-canvas";
import { usePackSounds, type SoundKey } from "./use-pack-sounds";

interface DrawnCard {
  cardId: string;
  name: string;
  rarity: string;
  coinValue: number;
  conversionValue: number;
  image: string | null;
  packIndex: number;
  cardIndex: number;
  status?: string;
  isGodpack?: boolean;
  godpackPosition?: number | null;
}

interface OpenResult {
  packGroupId: string;
  packCount: number;
  totalCost: number;
  newBalance: number;
  isRecovery?: boolean;
  cards: DrawnCard[];
  fairnessProof?: {
    commitmentId: string;
    nonceStart: number;
    nonceEnd: number;
  } | null;
  godpack?: {
    eventId: string;
    packIndex: number;
    game: string;
    totalCoinValue: number;
    poolFallbackUsed?: boolean;
    fairnessProof?: {
      commitmentId: string;
      nonceStart: number;
      nonceEnd: number;
    } | null;
  } | null;
}

interface BoxInfo {
  _id: string;
  name: { de: string; en: string };
  image?: string | null;
}

interface PackOpeningProps {
  result: OpenResult;
  box: BoxInfo;
  lang: string;
  onDone: () => void;
  quickOpen?: boolean;
}

type Phase = "idle" | "godpack-intro" | "ripping" | "reveal";

export function PackOpening({ result, box, lang, onDone, quickOpen }: PackOpeningProps) {
  const isDe = lang === "de";
  const { play, masterVolume, setMasterVolume } = usePackSounds();
  const prefersReducedMotion = useReducedMotion();

  // Suppress the global PendingPullsGuard while this component is mounted
  useEffect(() => {
    suppressPendingGuard(true);
    return () => suppressPendingGuard(false);
  }, []);

  const isRecovery = result.isRecovery ?? false;

  // Recovery / quickOpen / reduced motion → skip animation, hand off to guard immediately
  const skipAnimation = isRecovery || quickOpen || prefersReducedMotion;
  const isGodpack = Boolean(result.godpack);
  const godpackEventId = result.godpack?.eventId ?? null;
  const godpackAckedRef = useRef(false);
  // Wird true, sobald der User die Reveal-Phase betreten hat. Vorher wäre ein
  // Acknowledge ein Spoiler (andere User würden die Karten im Chat sehen
  // bevor der Glückliche sie selbst aufgedeckt hat). Auch verhindert das
  // den React-19/StrictMode-Double-Mount-Cleanup, der sonst das Acknowledge
  // sofort nach dem ersten Render feuern würde.
  const revealStartedRef = useRef(false);

  /**
   * Reveal-Acknowledge an den Server schicken. Wird in mehreren Pfaden
   * angetriggert (Continue-Button, Skip-Button, Tab-Close, Unmount nach
   * Reveal), damit der Chat-Broadcast nicht verloren geht. Client- und
   * server-seitig idempotent.
   */
  const fireGodpackAck = useCallback(() => {
    if (!godpackEventId || godpackAckedRef.current) return;
    if (!revealStartedRef.current) return;
    godpackAckedRef.current = true;
    void fetch(`/api/godpacks/${godpackEventId}/reveal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }).catch((err) => console.error("[godpack reveal acknowledge]", err));
  }, [godpackEventId]);

  // Tab-Close / Navigation als Fallback. Cleanup beim React-Unmount fired
  // ebenfalls, ist aber durch revealStartedRef gegen Strict-Mode-Doppel-
  // Mounts geschützt.
  useEffect(() => {
    if (!godpackEventId) return;
    const handler = () => fireGodpackAck();
    window.addEventListener("beforeunload", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
      fireGodpackAck();
    };
  }, [godpackEventId, fireGodpackAck]);

  const getInitialPhase = (): Phase | null => {
    if (skipAnimation) return null; // will finish immediately
    if (isGodpack) return "godpack-intro";
    return "ripping";
  };

  const [phase, setPhase] = useState<Phase | null>(getInitialPhase);

  const particleRef = useRef<ParticleCanvasHandle>(null);

  // When there's no animation phase, finish immediately and let the guard take over
  useEffect(() => {
    if (skipAnimation) {
      // Bei Recovery / quickOpen / reduced-motion gibt es keine Reveal-
      // Phase; das Acknowledge darf direkt feuern, weil der User selbst
      // ohnehin keine Karten-Animation sieht und damit kein Spoiler-
      // Konflikt entsteht.
      revealStartedRef.current = true;
      fireGodpackAck();
      // Unsuppress before onDone unmounts us, so the guard can show immediately
      suppressPendingGuard(false);
      notifyPendingPulls();
      onDone();
    }
  }, [skipAnimation, onDone, fireGodpackAck]);

  // Lock body scroll during animation overlay
  useEffect(() => {
    if (phase === null) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [phase]);

  // Reveal-Start markieren: erst ab phase=="reveal" darf das Acknowledge
  // tatsächlich feuern. Vorher (godpack-intro, ripping) wäre eine
  // Chat-Message Spoiler.
  useEffect(() => {
    if (phase === "reveal") {
      revealStartedRef.current = true;
    }
  }, [phase]);

  const cards = result.cards;
  const boxName = isDe ? (box.name.de || box.name.en) : (box.name.en || box.name.de);

  const handlePlaySound = useCallback((key: string, volume?: number) => {
    play(key as SoundKey, volume);
  }, [play]);

  /** Called when the reveal grid finishes — hand off to PendingPullsGuard */
  const handleAnimationDone = useCallback(() => {
    // Reveal ist beendet (egal ob durchgespielt oder geskippt) — jetzt darf
    // der Server die Chat-Message broadcasten, vorher würde sie das Pack
    // für den User spoilern.
    fireGodpackAck();
    // Unsuppress before onDone unmounts us, so the guard can show immediately
    suppressPendingGuard(false);
    notifyPendingPulls();
    onDone();
  }, [onDone, fireGodpackAck]);

  // If no animation phase (recovery/quickOpen/reduced-motion), render nothing
  if (phase === null) return null;

  // ─── ANIMATION PHASES: fullscreen overlay for ripping + reveal ───
  return (
    <div className="fixed inset-0 z-80 flex flex-col items-center justify-center overflow-auto bg-[#08070d]">
      {/* Cosmic Backdrop — only for godpack openings */}
      {isGodpack && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 50% 35%, rgba(255, 200, 80, 0.10) 0%, rgba(180, 80, 255, 0.10) 30%, rgba(40, 10, 80, 0.35) 60%, rgba(8, 4, 22, 0.0) 80%)",
          }}
        />
      )}

      {/* Particle canvas — covers entire overlay */}
      <div className="absolute inset-0">
        <ParticleCanvas ref={particleRef} />
      </div>

      {/* Controls — top right */}
      <div className="fixed top-4 right-4 z-[90] flex items-center gap-2">
        <SoundControl volume={masterVolume} onChange={setMasterVolume} />
        <button
          type="button"
          onClick={handleAnimationDone}
          className="flex items-center gap-1.5 bg-surface/80 backdrop-blur-sm border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-muted hover:text-text-primary transition-colors"
          aria-label={isDe ? "Überspringen" : "Skip"}
        >
          <SkipForward className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{isDe ? "Überspringen" : "Skip"}</span>
        </button>
      </div>

      {/* Content */}
      <div className={`relative z-10 w-full ${phase === "reveal" ? "max-w-4xl px-3 sm:px-6" : "max-w-md"}`}>
        {phase === "godpack-intro" && result.godpack && (
          <GodpackIntro
            game={result.godpack.game}
            lang={lang}
            particleRef={particleRef}
            onPlaySound={handlePlaySound}
            onIntroComplete={() => setPhase("ripping")}
          />
        )}
        {(phase === "idle" || phase === "ripping") && (
          <div className="relative flex flex-col items-center">
            {/* Focused glow halo behind the pack */}
            <div
              className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{
                width: 320,
                height: 420,
                borderRadius: "50%",
                background: isGodpack
                  ? "radial-gradient(circle, rgba(255,200,80,0.18) 0%, rgba(180,80,255,0.10) 45%, transparent 75%)"
                  : "radial-gradient(circle, rgba(155,255,0,0.06) 0%, rgba(155,255,0,0.03) 40%, transparent 70%)",
                filter: "blur(40px)",
              }}
            />
            {phase === "idle" ? (
              <Pack3D
                boxName={boxName}
                lang={lang}
                onReady={() => setPhase("ripping")}
              />
            ) : (
              <PackRipper
                boxName={boxName}
                cardCount={cards.length}
                particleRef={particleRef}
                onRipComplete={() => setPhase("reveal")}
                onPlaySound={handlePlaySound}
              />
            )}
          </div>
        )}
        {phase === "reveal" && (
          <CardRevealStack
            cards={cards}
            packCount={result.packCount}
            lang={lang}
            particleRef={particleRef}
            onPlaySound={handlePlaySound}
            onAllRevealed={handleAnimationDone}
            fairnessCommitmentId={
              result.godpack?.fairnessProof?.commitmentId
                ?? result.fairnessProof?.commitmentId
                ?? null
            }
            godpackEventId={result.godpack?.eventId ?? null}
          />
        )}
      </div>
    </div>
  );
}

// ─── Sound Control ────────────────────────────────────────────────────

function SoundControl({ volume, onChange }: { volume: number; onChange: (v: number) => void }) {
  const isMuted = volume <= 0;

  return (
    <div className="flex items-center gap-2 bg-surface/80 backdrop-blur-sm border border-border rounded-lg px-2.5 py-1.5">
      <button
        type="button"
        onClick={() => onChange(isMuted ? 0.5 : 0)}
        className="text-text-muted hover:text-text-primary transition-colors"
        aria-label={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={volume}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-16 sm:w-20 h-1 accent-pa-green cursor-pointer"
        aria-label="Sound volume"
      />
    </div>
  );
}
