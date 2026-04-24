import type { LucideIcon } from "lucide-react";
import {
  History,
  LayoutGrid,
  Package,
  ShieldCheck,
  ShoppingCart,
  Swords,
  Trophy,
  Zap,
} from "lucide-react";

export type NavItemKey = "dashboard" | "packs" | "battles" | "events" | "cart";

export interface NavAccent {
  bg: string;
  icon: string;
  hover: string;
}

export interface NavChildItem {
  key: string;
  labelKey: string;
  labelFallback: string;
  descKey: string;
  descFallback: string;
  href: (lang: string) => string;
  icon: LucideIcon;
  accent: NavAccent;
}

export interface NavItem {
  key: NavItemKey;
  labelKey: string;
  labelFallback: string;
  icon: LucideIcon;
  href: (lang: string) => string;
  /** Exact-match for active state (Dashboard); others use startsWith. */
  exactMatch?: boolean;
  disabled?: boolean;
  /** True → show on dashboard submenu panel (only battles right now). */
  hasMegaMenu?: boolean;
  children?: NavChildItem[];
  hasEventCountdown?: boolean;
  isCart?: boolean;
  soonBadge?: boolean;
}

export const NAV_ITEMS: readonly NavItem[] = [
  {
    key: "dashboard",
    labelKey: "dashboard",
    labelFallback: "Dashboard",
    icon: LayoutGrid,
    href: (lang) => `/${lang}/dashboard`,
    exactMatch: true,
  },
  {
    key: "packs",
    labelKey: "packs",
    labelFallback: "Packs",
    icon: Package,
    href: (lang) => `/${lang}/packs`,
    hasMegaMenu: true,
    children: [
      {
        key: "pullHistory",
        labelKey: "pull_history",
        labelFallback: "Pull-History",
        descKey: "pull_history_desc",
        descFallback: "Jeder Pull, den du je gezogen hast",
        href: (lang) => `/${lang}/account/history`,
        icon: History,
        accent: {
          bg: "bg-sky-500/10",
          icon: "text-sky-400",
          hover: "group-hover:text-sky-400",
        },
      },
      {
        key: "provablyFair",
        labelKey: "provably_fair",
        labelFallback: "Provably Fair",
        descKey: "provably_fair_desc",
        descFallback: "So prüfst du jede gezogene Karte selbst",
        href: (lang) => `/${lang}/provably-fair`,
        icon: ShieldCheck,
        accent: {
          bg: "bg-pa-green/10",
          icon: "text-pa-green",
          hover: "group-hover:text-pa-green",
        },
      },
    ],
  },
  {
    key: "battles",
    labelKey: "battles",
    labelFallback: "Battles",
    icon: Swords,
    href: (lang) => `/${lang}/battles`,
    hasMegaMenu: true,
    children: [
      {
        key: "leaderboard",
        labelKey: "leaderboard",
        labelFallback: "Bestenliste",
        descKey: "leaderboard_desc",
        descFallback: "Top Spieler und Rankings",
        href: (lang) => `/${lang}/leaderboard`,
        icon: Trophy,
        accent: {
          bg: "bg-amber-500/10",
          icon: "text-amber-400",
          hover: "group-hover:text-amber-400",
        },
      },
    ],
  },
  {
    key: "events",
    labelKey: "events",
    labelFallback: "Events",
    icon: Zap,
    href: (lang) => `/${lang}/events`,
    hasEventCountdown: true,
  },
  {
    key: "cart",
    labelKey: "cart",
    labelFallback: "Warenkorb",
    icon: ShoppingCart,
    href: (lang) => `/${lang}/cart`,
    isCart: true,
  },
];

export function isNavItemActive(pathname: string, item: NavItem, lang: string): boolean {
  const href = item.href(lang);
  return item.exactMatch ? pathname === href : pathname.startsWith(href);
}
