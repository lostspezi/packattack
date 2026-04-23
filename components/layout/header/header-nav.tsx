"use client";

import { Fragment } from "react";
import { usePathname } from "next/navigation";
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
}

export function HeaderNav({
  lang,
  dict,
  cartState,
  megaMenuSection,
  onOpenSection,
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

          const navItem = (
            <HeaderNavItem
              href={href}
              active={active}
              disabled={item.disabled}
              icon={<Icon className="h-4 w-4 shrink-0" />}
              label={dict[item.labelKey] ?? item.labelFallback}
              labelClassName="hidden lg:inline"
              megaMenuActive={megaMenuActive}
              aria-haspopup={item.hasMegaMenu ? "true" : undefined}
              aria-expanded={item.hasMegaMenu ? megaMenuActive : undefined}
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
            >
              {navItem}
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
