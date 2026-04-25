"use client";

import { Sparkles } from "lucide-react";

interface CompletionMeterProps {
  matched: number;
  expected: number;
  isDe: boolean;
}

export function CompletionMeter({
  matched,
  expected,
  isDe,
}: CompletionMeterProps) {
  if (expected === 0) return null;
  const ratio = matched / expected;
  const pct = Math.round(ratio * 100);
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - ratio);
  const complete = matched === expected;

  return (
    <div className="inline-flex items-center gap-3 bg-surface border border-border rounded-xl px-4 py-2.5">
      <div className="relative w-12 h-12">
        <svg viewBox="0 0 48 48" className="w-12 h-12 -rotate-90">
          <circle
            cx="24"
            cy="24"
            r={radius}
            stroke="currentColor"
            className="text-white/10"
            strokeWidth="4"
            fill="none"
          />
          <circle
            cx="24"
            cy="24"
            r={radius}
            stroke="currentColor"
            className={complete ? "text-pa-green" : "text-pa-green/80"}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            fill="none"
            style={{
              transition: "stroke-dashoffset 600ms cubic-bezier(0.23,1,0.32,1)",
            }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-text-primary">
          {pct}%
        </span>
      </div>
      <div className="text-sm">
        <p className="font-bold text-text-primary inline-flex items-center gap-1.5">
          {complete && <Sparkles className="w-3.5 h-3.5 text-pa-green" />}
          {matched} / {expected}
        </p>
        <p className="text-xs text-text-muted">
          {complete
            ? isDe
              ? "Set komplett — Glückwunsch!"
              : "Set complete — congrats!"
            : isDe
              ? "Karten gefunden"
              : "cards matched"}
        </p>
      </div>
    </div>
  );
}
