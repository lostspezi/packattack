"use client";

import { Fragment } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { HeaderNavItem, HeaderNavGroup } from "./header-nav-item";
import type { MegaMenuSection } from "./mega-menu";
import type { CartState } from "./use-cart-state";
import { NAV_ITEMS, type NavItem, isNavItemActive } from "./nav-config";
import { EventCountdownBadge } from "@/components/events/event-countdown-badge";

interface HeaderNavProps {
  lang: string;
  dict: Record<string, string>;
  cartState: CartState;
  megaMenuSection: MegaMenuSection;
  onOpenSection: (section: MegaMenuSection, triggerEl: HTMLElement) => void;
  onCloseSection: () => void;
}

export function HeaderNav({
  lang,
  dict,
  cartState,
  megaMenuSection,
  onOpenSection,
  onCloseSection,
}: HeaderNavProps) {
  const pathname = usePathname();

  function handleOpen(
    section: MegaMenuSection,
    e: React.MouseEvent<HTMLDivElement> | React.FocusEvent<HTMLDivElement>,
  ) {
    onOpenSection(section, e.currentTarget);
  }

  function renderChildren(item: NavItem) {
    if (item.hasEventCountdown) {
      return <EventCountdownBadge />;
    }
    if (item.isCart && cartState.cartCount > 0) {
      return (
        <>
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-pa-green px-1.5 text-[10px] font-bold text-black">
            {cartState.cartCount}
          </span>
          <span
            className={`font-mono text-[11px] tabular-nums ${cartState.timerColor(cartState.cartTimer)}`}
            title={cartState.formatTimer(cartState.cartTimer)}
          >
            {cartState.formatTimerCompact(cartState.cartTimer)}
          </span>
        </>
      );
    }
    return null;
  }

  return (
    <HeaderNavGroup>
      <nav className="hidden items-center gap-1 md:flex">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const href = item.href(lang);
          const active = isNavItemActive(pathname, item, lang);
          const megaMenuActive = item.hasMegaMenu && megaMenuSection === item.key;
          const label = dict[item.labelKey] ?? item.labelFallback;

          const navItem = (
            <HeaderNavItem
              href={href}
              active={active}
              disabled={item.disabled}
              icon={<Icon className="h-4 w-4 shrink-0" />}
              label={label}
              labelClassName={
                item.isCart && cartState.cartCount > 0 ? "hidden" : "hidden lg:inline"
              }
              megaMenuActive={megaMenuActive}
              badge={
                item.soonBadge ? (
                  <span className="inline-flex items-center rounded border border-pa-green/20 bg-pa-green/10 px-1.5 py-0.5 text-[10px] font-semibold text-pa-green">
                    Soon
                  </span>
                ) : undefined
              }
            >
              {renderChildren(item)}
            </HeaderNavItem>
          );

          const wrapped = item.hasMegaMenu ? (
            <div
              onMouseEnter={(e) => handleOpen(item.key as MegaMenuSection, e)}
              onFocus={(e) => handleOpen(item.key as MegaMenuSection, e)}
              className="flex items-center"
            >
              {navItem}
              <button
                type="button"
                onClick={(e) => {
                  if (megaMenuActive) {
                    onCloseSection();
                  } else {
                    onOpenSection(item.key as MegaMenuSection, e.currentTarget);
                  }
                }}
                aria-haspopup="true"
                aria-expanded={megaMenuActive}
                aria-label={`${label} Untermenü`}
                className={`-ml-1 inline-flex h-9 w-7 items-center justify-center rounded-lg transition-colors hover:bg-white/5 ${
                  megaMenuActive ? "text-pa-green" : "text-text-muted hover:text-text-primary"
                }`}
              >
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform duration-200 ${
                    megaMenuActive ? "rotate-180" : ""
                  }`}
                />
              </button>
            </div>
          ) : (
            navItem
          );

          return <Fragment key={item.key}>{wrapped}</Fragment>;
        })}
      </nav>
    </HeaderNavGroup>
  );
}
