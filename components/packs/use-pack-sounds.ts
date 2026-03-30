"use client";

import { useRef, useEffect, useCallback } from "react";

const SOUND_MAP = {
  rip: "/sounds/pack-rip.mp3",
  burst: "/sounds/pack-burst.mp3",
  flip: "/sounds/card-flip.mp3",
  shimmer: "/sounds/card-shimmer.mp3",
  epic: "/sounds/card-epic.mp3",
  legendary: "/sounds/card-legendary.mp3",
} as const;

export type SoundKey = keyof typeof SOUND_MAP;

export function usePackSounds() {
  const audioCache = useRef<Map<SoundKey, HTMLAudioElement>>(new Map());

  useEffect(() => {
    const cache = audioCache.current;
    for (const [key, src] of Object.entries(SOUND_MAP)) {
      const audio = new Audio(src);
      audio.preload = "auto";
      cache.set(key as SoundKey, audio);
    }
    return () => {
      cache.forEach((audio) => { audio.pause(); audio.src = ""; });
      cache.clear();
    };
  }, []);

  const play = useCallback((key: SoundKey, volume = 0.5) => {
    const audio = audioCache.current.get(key);
    if (!audio) return;
    const clone = audio.cloneNode() as HTMLAudioElement;
    clone.volume = Math.min(1, Math.max(0, volume));
    clone.play().catch(() => {});
  }, []);

  return { play };
}
