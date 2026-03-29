"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { X, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ActiveBattleBannerProps {
  lang: string;
}

interface ActiveBattle {
  slug: string;
}

export function ActiveBattleBanner({ lang }: ActiveBattleBannerProps) {
  const [battle, setBattle] = useState<ActiveBattle | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch("/api/battles/active")
      .then((res) => res.json())
      .then((data) => setBattle(data.battle ?? null))
      .catch(() => setBattle(null));
  }, []);

  if (!battle || dismissed) return null;

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-4 bg-amber-400 px-4 py-2.5 text-amber-950">
      <div className="flex items-center gap-2.5">
        <Swords className="h-4 w-4 shrink-0" />
        <p className="text-sm font-semibold">
          Du bist in einem aktiven Battle!
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Link href={`/${lang}/battles/${battle.slug}`}>
          <Button
            variant="primary"
            size="sm"
            className="bg-amber-900 text-amber-50 hover:bg-amber-800"
          >
            Zurück zum Battle
          </Button>
        </Link>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="rounded p-1 hover:bg-amber-500 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
