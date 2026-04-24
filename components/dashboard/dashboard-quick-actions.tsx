import Link from "next/link";
import { Card } from "@/components/ui/card";
import {
  Package,
  Swords,
  ShoppingBag,
  Trophy,
  Layers,
  Zap,
} from "lucide-react";

interface DashboardQuickActionsProps {
  lang: string;
}

interface ActionTile {
  icon: React.ReactNode;
  label: string;
  hint: string;
  href: string;
}

export function DashboardQuickActions({ lang }: DashboardQuickActionsProps) {
  const tiles: ActionTile[] = [
    {
      icon: <Package className="w-5 h-5" />,
      label: "Pack öffnen",
      hint: "Neue Karten ziehen",
      href: "/packs",
    },
    {
      icon: <Swords className="w-5 h-5" />,
      label: "Battles",
      hint: "Lobby & Ranglisten",
      href: "/battles",
    },
    {
      icon: <Zap className="w-5 h-5" />,
      label: "Events",
      hint: "Quiz & Specials",
      href: "/events",
    },
    {
      icon: <ShoppingBag className="w-5 h-5" />,
      label: "Bestellungen",
      hint: "Versandstatus",
      href: "/orders",
    },
    {
      icon: <Layers className="w-5 h-5" />,
      label: "Inventar",
      hint: "Pulls & Cart",
      href: "/cart",
    },
    {
      icon: <Trophy className="w-5 h-5" />,
      label: "Bestenliste",
      hint: "Wer ist vorn?",
      href: "/leaderboard",
    },
  ];

  return (
    <div>
      <h3 className="text-lg font-semibold text-text-primary mb-3">
        Was willst du als nächstes tun?
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {tiles.map((tile) => (
          <Link key={tile.href} href={`/${lang}${tile.href}`}>
            <Card
              variant="soft"
              className="p-4 h-full transition-colors hover:bg-white/6 cursor-pointer"
            >
              <div className="flex flex-col gap-2">
                <div className="w-10 h-10 rounded-lg bg-pa-green/10 flex items-center justify-center text-pa-green">
                  {tile.icon}
                </div>
                <p className="text-text-primary font-semibold text-sm">
                  {tile.label}
                </p>
                <p className="text-text-muted text-xs">{tile.hint}</p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
