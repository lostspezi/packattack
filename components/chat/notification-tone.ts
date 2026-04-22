"use client";

// Singleton AudioContext — browsers cap simultaneous AudioContexts (~6).
// Instantiating a new one per notification leaks state, stresses the GC, and
// noticeably stalls the main thread during bursts of chat events.
let sharedCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (sharedCtx && sharedCtx.state !== "closed") return sharedCtx;
  const Ctor =
    typeof window === "undefined"
      ? undefined
      : window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
  if (!Ctor) {
    throw new Error("audio_unsupported");
  }
  sharedCtx = new Ctor();
  return sharedCtx;
}

export function playNotificationTone(kind: "mention" | "staff") {
  if (typeof window === "undefined") return;
  const ctx = getAudioContext();
  // Chrome autoplay policy: the context starts suspended until the first
  // user gesture. Resume lazily; ignore the promise, any later events will
  // play through the same unlocked context.
  if (ctx.state === "suspended") {
    void ctx.resume();
  }
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = kind === "mention" ? 880 : 660;
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.04, ctx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + 0.2);
}
