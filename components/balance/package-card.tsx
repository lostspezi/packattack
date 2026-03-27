"use client";

import { Coins } from "lucide-react";
import { Card } from "@/components/ui/card";

interface PackageCardProps {
  pkg: {
    _id: string;
    name: { de: string; en: string };
    baseCoins: number;
    bonusCoins: number;
    priceEurCents: number;
    icon: string | null;
    highlightLabel: { de: string; en: string } | null;
  };
  lang: string;
  onSelect: (packageId: string) => void;
  disabled?: boolean;
}

export function PackageCard({
  pkg,
  lang,
  onSelect,
  disabled,
}: PackageCardProps) {
  const name = lang === "en" ? pkg.name.en : pkg.name.de;
  const highlight =
    pkg.highlightLabel &&
    (lang === "en" ? pkg.highlightLabel.en : pkg.highlightLabel.de);
  const priceEur = (pkg.priceEurCents / 100).toFixed(2).replace(".", ",");

  return (
    <button
      onClick={() => onSelect(pkg._id)}
      disabled={disabled}
      className="text-left w-full disabled:opacity-50 disabled:cursor-not-allowed group"
    >
      <Card
        variant={highlight ? "accent" : "soft"}
        className={`relative p-5 text-center transition-all group-hover:border-pa-green/40 group-hover:shadow-[0_0_20px_rgba(155,255,0,0.08)] ${
          highlight ? "border-pa-green/30 shadow-[0_0_20px_rgba(155,255,0,0.08)]" : ""
        }`}
      >
        {highlight && (
          <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-pa-green text-bg text-[11px] font-extrabold px-3 py-0.5 rounded-full uppercase">
            {highlight}
          </span>
        )}

        <div className="text-3xl mb-2">{pkg.icon || "🪙"}</div>
        <div className="font-bold text-text-primary text-[15px]">{name}</div>
        <div className="text-2xl font-extrabold text-pa-green my-2">
          {pkg.baseCoins}
          {pkg.bonusCoins > 0 && (
            <span className="text-sm text-pa-green/70 ml-1">
              +{pkg.bonusCoins}
            </span>
          )}
        </div>
        <div className="text-text-secondary text-xs flex items-center justify-center gap-1">
          <Coins className="h-3 w-3" />
          Münzen
        </div>
        <div className="bg-white/5 rounded-lg py-2 mt-3">
          <span className="font-bold text-text-primary">{priceEur} €</span>
        </div>
      </Card>
    </button>
  );
}
