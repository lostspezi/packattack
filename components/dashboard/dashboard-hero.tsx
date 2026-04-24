import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { HeroAction } from "@/lib/dashboard/hero-action";

interface DashboardHeroProps {
  lang: string;
  userName: string;
  hero: HeroAction;
}

const KIND_BLURB: Record<HeroAction["kind"], string> = {
  pending_pulls:
    "Du hast noch offene Pulls. Schließ sie ab, dann geht's weiter.",
  active_battle: "Dein Battle läuft. Spring zurück rein, bevor's eng wird.",
  active_quiz: "Ein Quiz ist live. Mach mit und sicher dir ein Badge.",
  default: "Willkommen zurück. Was machen wir heute?",
};

export function DashboardHero({ lang, userName, hero }: DashboardHeroProps) {
  return (
    <Card variant="cut" className="p-6 md:p-8 relative overflow-hidden">
      <div
        className="absolute inset-0 bg-gradient-to-br from-pa-lila/30 via-transparent to-pa-green/4 pointer-events-none"
        aria-hidden
      />
      <div className="relative flex flex-col md:flex-row md:items-end gap-6 justify-between">
        <div className="space-y-2">
          <p className="text-text-muted text-xs uppercase tracking-wider font-semibold">
            Hi {userName}
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-text-primary">
            {hero.primaryLabel}
          </h1>
          <p className="text-text-secondary text-sm md:text-base max-w-xl">
            {KIND_BLURB[hero.kind]}
          </p>
        </div>

        <div className="flex flex-wrap gap-3 shrink-0">
          <Link href={`/${lang}${hero.primaryHref}`}>
            <Button size="lg">
              {hero.primaryLabel} <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          {hero.secondaryHref && hero.secondaryLabel && (
            <Link href={`/${lang}${hero.secondaryHref}`}>
              <Button variant="secondary" size="lg">
                {hero.secondaryLabel}
              </Button>
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}
