"use client";

import { Check } from "lucide-react";

export const BINDER_THEMES = [
  {
    key: "classic",
    label: { de: "Klassisch", en: "Classic" },
    accent: "#9bff00",
    swatchClass: "bg-gradient-to-br from-zinc-900 to-zinc-700",
  },
  {
    key: "premium-gold",
    label: { de: "Premium Gold", en: "Premium Gold" },
    accent: "#f5c542",
    swatchClass: "bg-gradient-to-br from-amber-900 via-yellow-700 to-amber-500",
  },
  {
    key: "holo",
    label: { de: "Holo", en: "Holo" },
    accent: "#a78bfa",
    swatchClass:
      "bg-gradient-to-br from-purple-700 via-pink-600 to-cyan-400",
  },
  {
    key: "wald",
    label: { de: "Wald", en: "Forest" },
    accent: "#34d399",
    swatchClass:
      "bg-gradient-to-br from-emerald-900 via-emerald-700 to-emerald-500",
  },
  {
    key: "ozean",
    label: { de: "Ozean", en: "Ocean" },
    accent: "#38bdf8",
    swatchClass: "bg-gradient-to-br from-sky-900 via-cyan-700 to-cyan-400",
  },
] as const;

export type ThemeKey = (typeof BINDER_THEMES)[number]["key"];

export function ThemePicker({
  value,
  onChange,
  isDe,
}: {
  value: ThemeKey;
  onChange: (next: ThemeKey) => void;
  isDe: boolean;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {BINDER_THEMES.map((t) => {
        const active = value === t.key;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={[
              "rounded-xl p-1 border transition-colors",
              active
                ? "border-pa-green ring-2 ring-pa-green/30"
                : "border-white/8 hover:border-white/20",
            ].join(" ")}
          >
            <div
              className={`relative h-20 rounded-lg ${t.swatchClass} flex items-end p-2`}
            >
              {active && (
                <Check className="absolute top-2 right-2 w-4 h-4 text-white" />
              )}
              <span className="text-xs font-bold text-white/95 drop-shadow">
                {isDe ? t.label.de : t.label.en}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
