// components/arena/arena-pixi.tsx
// PixiJS 8 Application setup with scene tree.
// Loaded via dynamic import (SSR: false) from arena-canvas.tsx.
"use client";

import { useEffect, useRef, useCallback } from "react";
import { Application } from "pixi.js";
import { ARENA_COLORS, ARENA_ASPECT_RATIO } from "@/lib/arena-constants";
import { TweenManager } from "./tween";
import { BattleBridge, type BattleState } from "./battle-bridge";
import { BackgroundLayer } from "./layers/background";
import { ArenaFloorLayer } from "./layers/arena-floor";

interface HandCard {
  index: number;
  card: string;
  coinValue: number;
  rarity: string;
  name: string;
  image: string;
}

interface PlayedCard {
  playerId: string;
  card: { _id: string; name: string; image: string };
  coinValue: number;
  rarity: string;
  effectTier: string;
}

export interface ArenaPixiProps {
  battle: {
    _id: string;
    status: string;
    currentRound: number;
    totalRounds: number;
    players: Array<{ user: { _id: string; name: string } }>;
  };
  isPlayer: boolean;
  currentUserId: string | null;
  // SSE-driven state
  roundAnnounce: { roundIndex: number; revealOrder: string[]; totalRounds?: number } | null;
  handCards: HandCard[] | null;
  selectedCardIndex: number | null;
  playersSelected: Set<string>;
  revealedPlayedCards: PlayedCard[] | null;
  roundResult: { winnerId: string | null; isClose: boolean } | null;
  onSelectCard: (cardIndex: number) => void;
}

export default function ArenaPixi(props: ArenaPixiProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const bridgeRef = useRef<BattleBridge | null>(null);

  // Initialize PixiJS Application
  const initApp = useCallback(async () => {
    if (!containerRef.current || appRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = Math.round(width / ARENA_ASPECT_RATIO);

    const app = new Application();
    await app.init({
      width,
      height,
      backgroundColor: ARENA_COLORS.bg,
      antialias: false,
      resolution: Math.min(window.devicePixelRatio, 2),
      autoDensity: true,
    });

    container.appendChild(app.canvas);
    appRef.current = app;

    // Build scene tree
    const tweenManager = new TweenManager();
    const background = new BackgroundLayer();
    const arenaFloor = new ArenaFloorLayer();

    app.stage.addChild(background);
    app.stage.addChild(arenaFloor);

    // Create bridge
    const bridge = new BattleBridge(
      { background, arenaFloor },
      tweenManager,
    );
    bridgeRef.current = bridge;

    // Initial resize
    bridge.resize(width, height);

    // Ticker
    app.ticker.add(() => {
      bridge.update(app.ticker.deltaMS);
    });

    // Responsive resize
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const h = Math.round(w / ARENA_ASPECT_RATIO);
        app.renderer.resize(w, h);
        bridge.resize(w, h);
      }
    });
    resizeObserver.observe(container);

    // Store for cleanup
    (app as unknown as Record<string, unknown>).__resizeObserver = resizeObserver;
  }, []);

  // Init on mount, cleanup on unmount
  useEffect(() => {
    initApp();
    return () => {
      const app = appRef.current;
      if (app) {
        const observer = (app as unknown as Record<string, unknown>).__resizeObserver as ResizeObserver | undefined;
        observer?.disconnect();
        bridgeRef.current?.destroy();
        app.destroy(true, { children: true, texture: true, textureSource: true });
        appRef.current = null;
        bridgeRef.current = null;
      }
    };
  }, [initApp]);

  // Sync React state → BattleBridge
  useEffect(() => {
    bridgeRef.current?.updateState({
      status: props.battle.status,
      currentRound: props.battle.currentRound,
      totalRounds: props.battle.totalRounds,
      playerCount: props.battle.players.length,
      isPlayer: props.isPlayer,
      currentUserId: props.currentUserId,
    });
  }, [props.battle.status, props.battle.currentRound, props.battle.totalRounds, props.battle.players.length, props.isPlayer, props.currentUserId]);

  // Forward SSE events to bridge
  useEffect(() => {
    if (props.roundAnnounce) {
      bridgeRef.current?.onRoundAnnounce(props.roundAnnounce as { roundIndex: number; totalRounds: number });
    }
  }, [props.roundAnnounce]);

  useEffect(() => {
    if (props.handCards) {
      bridgeRef.current?.onHandDealt({ cards: props.handCards });
    }
  }, [props.handCards]);

  useEffect(() => {
    if (props.revealedPlayedCards) {
      bridgeRef.current?.onCardsReveal({ cards: props.revealedPlayedCards });
    }
  }, [props.revealedPlayedCards]);

  useEffect(() => {
    if (props.roundResult) {
      bridgeRef.current?.onRoundResult(props.roundResult);
    }
  }, [props.roundResult]);

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-xl border border-border bg-bg"
      style={{ aspectRatio: `${ARENA_ASPECT_RATIO}` }}
    />
  );
}
