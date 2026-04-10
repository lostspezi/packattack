"use client";

import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Package,
  Swords,
  Trophy,
  ShoppingCart,
  ShoppingBag,
  Zap,
} from "lucide-react";
import { HeaderNavItem, HeaderNavGroup } from "./header-nav-item";
import type { MegaMenuSection } from "./mega-menu";
import type { CartState } from "./use-cart-state";
import { EventCountdownBadge } from "@/components/events/event-countdown-badge";

interface HeaderNavProps {
  lang: string;
  dict: Record<string, string>;
  userRole?: string;
  cartState: CartState;
  megaMenuSection: MegaMenuSection;
  onOpenSection: (section: MegaMenuSection, triggerEl: HTMLElement) => void;
}

export function HeaderNav({
  lang,
  dict,
  userRole,
  cartState,
  megaMenuSection,
  onOpenSection,
}: HeaderNavProps) {
  const isAdmin = userRole === "admin" || userRole === "super_admin";
  const pathname = usePathname();
  const dashboardHref = `/${lang}/dashboard`;
  const isDashboardActive = pathname === dashboardHref;

  function handleOpen(section: MegaMenuSection, e: React.MouseEvent<HTMLDivElement> | React.FocusEvent<HTMLDivElement>) {
    onOpenSection(section, e.currentTarget);
  }

  return (
    <HeaderNavGroup>
    <nav className="hidden items-center gap-1 md:flex">
      <HeaderNavItem
        href={dashboardHref}
        active={isDashboardActive}
        icon={<LayoutGrid className="h-4 w-4 shrink-0" />}
        label={dict["dashboard"] ?? "Dashboard"}
      />

      <div
        onMouseEnter={(e) => handleOpen("packs", e)}
        onFocus={(e) => handleOpen("packs", e)}
      >
        <HeaderNavItem
          href={`/${lang}/packs`}
          active={pathname.startsWith(`/${lang}/packs`)}
          icon={<Package className="h-4 w-4 shrink-0" />}
          label={dict["packs"] ?? "Packs"}
          megaMenuActive={megaMenuSection === "packs"}
          aria-haspopup="true"
          aria-expanded={megaMenuSection === "packs"}
        />
      </div>

      <div
        onMouseEnter={(e) => handleOpen("battles", e)}
        onFocus={(e) => handleOpen("battles", e)}
      >
        <HeaderNavItem
          href={`/${lang}/battles`}
          active={pathname.startsWith(`/${lang}/battles`)}
          icon={<Swords className="h-4 w-4 shrink-0" />}
          label={dict["battles"] ?? "Battles"}
          megaMenuActive={megaMenuSection === "battles"}
          aria-haspopup="true"
          aria-expanded={megaMenuSection === "battles"}
        />
      </div>

      <HeaderNavItem
        href={`/${lang}/leaderboard`}
        active={pathname.startsWith(`/${lang}/leaderboard`)}
        icon={<Trophy className="h-4 w-4 shrink-0" />}
        label={dict["leaderboard"] ?? "Bestenliste"}
      />

      <HeaderNavItem
        href={`/${lang}/events`}
        active={pathname.startsWith(`/${lang}/events`)}
        icon={<Zap className="h-4 w-4 shrink-0" />}
        label={dict["events"] ?? "Events"}
      >
        <EventCountdownBadge />
      </HeaderNavItem>

      <div
        onMouseEnter={(e) => handleOpen("cart", e)}
        onFocus={(e) => handleOpen("cart", e)}
      >
        <HeaderNavItem
          href={`/${lang}/cart`}
          active={pathname.startsWith(`/${lang}/cart`)}
          icon={<ShoppingCart className="h-4 w-4 shrink-0" />}
          label={dict["cart"] ?? "Warenkorb"}
          megaMenuActive={megaMenuSection === "cart"}
        >
          {cartState.cartCount > 0 && (
            <>
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-pa-green px-1.5 text-[10px] font-bold text-black">
                {cartState.cartCount}
              </span>
              <span className={`font-mono text-xs ${cartState.timerColor(cartState.cartTimer)}`}>
                {cartState.formatTimer(cartState.cartTimer)}
              </span>
            </>
          )}
        </HeaderNavItem>
      </div>

      <HeaderNavItem
        href="#"
        active={false}
        disabled
        icon={<ShoppingBag className="h-4 w-4 shrink-0" />}
        label={dict["marketplace"] ?? "Marktplatz"}
        badge={
          <span className="inline-flex items-center rounded border border-pa-green/20 bg-pa-green/10 px-1.5 py-0.5 text-[10px] font-semibold text-pa-green">
            Soon
          </span>
        }
      />
    </nav>
    </HeaderNavGroup>
  );
}
