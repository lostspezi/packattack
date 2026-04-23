"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown } from "lucide-react";
import { LanguageSwitcher } from "../language-switcher";
import type { CartState } from "./use-cart-state";
import { NAV_ITEMS, type NavItem, isNavItemActive } from "./nav-config";
import { EventCountdownBadge } from "@/components/events/event-countdown-badge";

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

  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  function toggleSection(key: string) {
    setExpandedKey((prev) => (prev === key ? null : key));
  }

  const linkClass = (active: boolean) =>
    [
      "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
      active ? "bg-pa-green/6 text-pa-green" : "text-text-muted hover:text-text-primary",
    ].join(" ");

  const subLinkClass =
    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-text-muted transition-colors hover:text-text-primary hover:bg-white/3";

  function renderItemExtras(item: NavItem) {
    if (item.hasEventCountdown) return <EventCountdownBadge />;
    if (item.isCart && cartState.cartCount > 0) {
      return (
        <>
          <span
            className={`font-mono text-xs tabular-nums ${cartState.timerColor(cartState.cartTimer)}`}
          >
            {cartState.formatTimer(cartState.cartTimer)}
          </span>
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-pa-green px-1.5 text-[10px] font-bold text-black">
            {cartState.cartCount}
          </span>
        </>
      );
    }
    if (item.soonBadge) {
      return (
        <span className="inline-flex items-center rounded border border-pa-green/20 bg-pa-green/10 px-1.5 py-0.5 text-[10px] font-semibold text-pa-green">
          Soon
        </span>
      );
    }
    return null;
  }

  function renderItem(item: NavItem) {
    const Icon = item.icon;
    const label = dict[item.labelKey] ?? item.labelFallback;
    const active = isNavItemActive(pathname, item, lang);

    if (item.disabled) {
      return (
        <span
          key={item.key}
          className="flex select-none items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-text-muted opacity-35"
        >
          <Icon className="h-5 w-5 shrink-0" />
          <span className="flex-1">{label}</span>
          {renderItemExtras(item)}
        </span>
      );
    }

    if (item.children && item.children.length > 0) {
      const expanded = expandedKey === item.key;
      return (
        <div key={item.key}>
          <button
            type="button"
            onClick={() => toggleSection(item.key)}
            className={[
              "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
              active
                ? "bg-pa-green/6 text-pa-green"
                : "text-text-muted hover:text-text-primary",
            ].join(" ")}
            aria-expanded={expanded}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span className="flex-1 text-left">{label}</span>
            <ChevronDown
              className={[
                "h-4 w-4 shrink-0 transition-transform duration-200",
                expanded ? "rotate-180" : "",
              ].join(" ")}
            />
          </button>
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden pl-4"
              >
                {item.children.map((child) => {
                  const ChildIcon = child.icon;
                  return (
                    <Link
                      key={child.key}
                      href={child.href(lang)}
                      onClick={onClose}
                      className={subLinkClass}
                    >
                      <ChildIcon className="h-4 w-4 shrink-0" />
                      <span>{dict[child.labelKey] ?? child.labelFallback}</span>
                    </Link>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    }

    return (
      <Link
        key={item.key}
        href={item.href(lang)}
        onClick={onClose}
        className={linkClass(active)}
      >
        <Icon className="h-5 w-5 shrink-0" />
        <span className="flex-1">{label}</span>
        {renderItemExtras(item)}
      </Link>
    );
  }

  return (
    <div
      className="fixed inset-0 z-70 flex md:hidden"
      role="dialog"
      aria-modal={open}
      aria-hidden={!open}
      inert={!open}
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

        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map(renderItem)}
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
