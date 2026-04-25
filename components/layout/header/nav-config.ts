import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Compass,
  History,
  LayoutGrid,
  Library,
  Package,
  ShieldCheck,
  ShoppingCart,
  Swords,
  Trophy,
  Zap,
} from "lucide-react";

export type NavItemKey =
  | "dashboard"
  | "packs"
  | "battles"
  | "collection"
  | "events"
  | "cart";

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
        key: "packsOverview",
        labelKey: "packs_overview",
        labelFallback: "Alle Packs",
        descKey: "packs_overview_desc",
        descFallback: "Alle verfügbaren Packs durchstöbern",
        href: (lang) => `/${lang}/packs`,
        icon: Package,
        accent: {
          bg: "bg-fuchsia-500/15",
          icon: "text-fuchsia-300",
          hover: "group-hover:text-fuchsia-300",
        },
      },
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
        key: "battlesOverview",
        labelKey: "battles_overview",
        labelFallback: "Alle Battles",
        descKey: "battles_overview_desc",
        descFallback: "Offene Battles beitreten oder starten",
        href: (lang) => `/${lang}/battles`,
        icon: Swords,
        accent: {
          bg: "bg-rose-500/15",
          icon: "text-rose-300",
          hover: "group-hover:text-rose-300",
        },
      },
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
    key: "collection",
    labelKey: "collection",
    labelFallback: "Sammlung",
    icon: Library,
    href: (lang) => `/${lang}/collection`,
    hasMegaMenu: true,
    children: [
      {
        key: "myCollection",
        labelKey: "my_collection",
        labelFallback: "Meine Sammlung",
        descKey: "my_collection_desc",
        descFallback: "Alle Karten, die dir gehören",
        href: (lang) => `/${lang}/collection`,
        icon: Library,
        accent: {
          bg: "bg-emerald-500/10",
          icon: "text-emerald-400",
          hover: "group-hover:text-emerald-400",
        },
      },
      {
        key: "binders",
        labelKey: "binders",
        labelFallback: "Binder",
        descKey: "binders_desc",
        descFallback: "Sammelalben aus deinen Karten",
        href: (lang) => `/${lang}/binders`,
        icon: BookOpen,
        accent: {
          bg: "bg-amber-500/10",
          icon: "text-amber-400",
          hover: "group-hover:text-amber-400",
        },
      },
      {
        key: "bindersExplore",
        labelKey: "binders_explore",
        labelFallback: "Binder-Galerie",
        descKey: "binders_explore_desc",
        descFallback: "Was die Community kuratiert",
        href: (lang) => `/${lang}/binders/explore`,
        icon: Compass,
        accent: {
          bg: "bg-violet-500/10",
          icon: "text-violet-400",
          hover: "group-hover:text-violet-400",
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
  if (item.exactMatch) return pathname === href;
  if (pathname.startsWith(href)) return true;
  for (const child of item.children ?? []) {
    if (pathname.startsWith(child.href(lang))) return true;
  }
  return false;
}
