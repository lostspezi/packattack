"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  LayoutGrid,
  Package,
  Swords,
  Trophy,
  ShoppingCart,
  ShoppingBag,
  ChevronDown,
  Search,
  Sparkles,
  Clock,
  User,
} from "lucide-react";
import { LanguageSwitcher } from "../language-switcher";
import type { CartState } from "./use-cart-state";

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  lang: string;
  dict: Record<string, string>;
  languages: { code: string; name: string }[];
  cartState: CartState;
  userName: string;
  avatarUrl: string;
  levelLabel: string;
}

export function MobileDrawer({
  open,
  onClose,
  lang,
  dict,
  languages,
  cartState,
  userName,
  avatarUrl,
  levelLabel,
}: MobileDrawerProps) {
  const pathname = usePathname();
  const router = useRouter();
  const dashboardHref = `/${lang}/dashboard`;
  const isDashboardActive = pathname === dashboardHref;

  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  function toggleSection(section: string) {
    setExpandedSection((prev) => (prev === section ? null : section));
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (trimmed) {
      router.push(`/${lang}/search?q=${encodeURIComponent(trimmed)}`);
      setSearchQuery("");
      onClose();
    }
  }

  const linkClass = (active: boolean) =>
    [
      "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
      active ? "bg-pa-green/6 text-pa-green" : "text-text-muted hover:text-text-primary",
    ].join(" ");

  const subLinkClass =
    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-text-muted transition-colors hover:text-text-primary hover:bg-white/3";

  return (
    <div
      className="fixed inset-0 z-70 flex md:hidden"
      role="dialog"
      aria-modal={open}
      aria-label="Navigation"
      style={{
        visibility: open ? "visible" : "hidden",
        transition: open ? "visibility 0s" : "visibility 0s 0.3s",
      }}
    >
      <div
        className={[
          "absolute inset-0 bg-black/60 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0",
        ].join(" ")}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className={[
          "relative flex w-72 max-w-[85vw] flex-col overflow-y-auto border-r border-border bg-surface transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <div className="flex h-16 shrink-0 items-center border-b border-border px-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo.svg" alt="PackAttack.gg" className="h-5 w-auto" />
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="border-b border-border px-3 py-3">
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={dict["search_placeholder"] ?? "Suchen..."}
              className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
            />
          </div>
        </form>

        <nav className="flex-1 space-y-1 px-3 py-4">
          <Link href={dashboardHref} onClick={onClose} className={linkClass(isDashboardActive)}>
            <LayoutGrid className="h-5 w-5 shrink-0" />
            <span>{dict["dashboard"] ?? "Dashboard"}</span>
          </Link>

          {/* Packs with accordion */}
          <div>
            <button
              onClick={() => toggleSection("packs")}
              className={[
                "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                pathname.startsWith(`/${lang}/packs`) ? "bg-pa-green/6 text-pa-green" : "text-text-muted hover:text-text-primary",
              ].join(" ")}
            >
              <Package className="h-5 w-5 shrink-0" />
              <span className="flex-1 text-left">{dict["packs"] ?? "Packs"}</span>
              <ChevronDown
                className={[
                  "h-4 w-4 shrink-0 transition-transform duration-200",
                  expandedSection === "packs" ? "rotate-180" : "",
                ].join(" ")}
              />
            </button>
            <AnimatePresence>
              {expandedSection === "packs" && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden pl-4"
                >
                  <Link href={`/${lang}/packs`} onClick={onClose} className={subLinkClass}>
                    <Package className="h-4 w-4 shrink-0" />
                    <span>{dict["all_packs"] ?? "Alle Packs"}</span>
                  </Link>
                  <Link href={`/${lang}/packs?sort=featured`} onClick={onClose} className={subLinkClass}>
                    <Sparkles className="h-4 w-4 shrink-0" />
                    <span>{dict["featured_packs"] ?? "Featured Packs"}</span>
                  </Link>
                  <Link href={`/${lang}/dashboard`} onClick={onClose} className={subLinkClass}>
                    <Clock className="h-4 w-4 shrink-0" />
                    <span>{dict["recently_opened"] ?? "Zuletzt geöffnet"}</span>
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Battles with accordion */}
          <div>
            <button
              onClick={() => toggleSection("battles")}
              className={[
                "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                pathname.startsWith(`/${lang}/battles`) ? "bg-pa-green/6 text-pa-green" : "text-text-muted hover:text-text-primary",
              ].join(" ")}
            >
              <Swords className="h-5 w-5 shrink-0" />
              <span className="flex-1 text-left">{dict["battles"] ?? "Battles"}</span>
              <ChevronDown
                className={[
                  "h-4 w-4 shrink-0 transition-transform duration-200",
                  expandedSection === "battles" ? "rotate-180" : "",
                ].join(" ")}
              />
            </button>
            <AnimatePresence>
              {expandedSection === "battles" && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden pl-4"
                >
                  <Link href={`/${lang}/battles`} onClick={onClose} className={subLinkClass}>
                    <Swords className="h-4 w-4 shrink-0" />
                    <span>{dict["join_battle"] ?? "Battle beitreten"}</span>
                  </Link>
                  <Link href={`/${lang}/battles?filter=mine`} onClick={onClose} className={subLinkClass}>
                    <User className="h-4 w-4 shrink-0" />
                    <span>{dict["my_battles"] ?? "Meine Battles"}</span>
                  </Link>
                  <Link href={`/${lang}/leaderboard`} onClick={onClose} className={subLinkClass}>
                    <Trophy className="h-4 w-4 shrink-0" />
                    <span>{dict["leaderboard"] ?? "Bestenliste"}</span>
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Link href={`/${lang}/cart`} onClick={onClose} className={linkClass(pathname.startsWith(`/${lang}/cart`))}>
            <ShoppingCart className="h-5 w-5 shrink-0" />
            <span className="flex-1">{dict["cart"] ?? "Warenkorb"}</span>
            {cartState.cartCount > 0 && (
              <>
                <span className={`font-mono text-xs ${cartState.timerColor(cartState.cartTimer)}`}>
                  {cartState.formatTimer(cartState.cartTimer)}
                </span>
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-pa-green px-1.5 text-[10px] font-bold text-black">
                  {cartState.cartCount}
                </span>
              </>
            )}
          </Link>

          <span className="flex select-none items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-text-muted opacity-35">
            <ShoppingBag className="h-5 w-5 shrink-0" />
            <span className="flex-1">{dict["marketplace"] ?? "Marktplatz"}</span>
            <span className="inline-flex items-center rounded border border-pa-green/20 bg-pa-green/10 px-1.5 py-0.5 text-[10px] font-semibold text-pa-green">
              Soon
            </span>
          </span>
        </nav>

        <div className="border-t border-border px-3 py-3">
          <div className="flex items-center justify-between px-3">
            <span className="text-sm text-text-muted">{dict["language"] ?? "Sprache"}</span>
            <LanguageSwitcher lang={lang} languages={languages} />
          </div>
        </div>

        <div className="shrink-0 px-3 pb-6">
          <div className="flex items-center gap-3 rounded-lg border border-white/6 bg-white/3 px-3 py-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatarUrl}
              alt={userName}
              width={32}
              height={32}
              className="h-8 w-8 shrink-0 rounded-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/images/default-avatar.png";
              }}
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-text-primary">{userName}</p>
              <p className="text-xs text-text-muted">{levelLabel} 1</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
