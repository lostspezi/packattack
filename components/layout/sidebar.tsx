"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { Menu, X, ChevronDown } from "lucide-react";
import * as LucideIcons from "lucide-react";
import {
  mainNavItems,
  adminPinnedItems,
  adminNavGroups,
  shopNavItems,
  soonNavItems,
  type NavItem,
  type AdminNavGroup,
} from "./sidebar-nav";

interface SidebarProps {
  lang: string;
  dict: Record<string, string>;
  adminDict: Record<string, string>;
  dashboardDict: Record<string, string>;
  userRole: string;
  userName: string;
  userInitial: string;
  /** "admin" = admin nav items; "shop" = shop nav items */
  mode: "admin" | "shop";
  /** Optional numeric badges keyed by NavItem.key (e.g. { boxes: 3 }). */
  badges?: Record<string, number>;
}

function NavIcon({ name, className }: { name: string; className?: string }) {
  const Icon = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[name];
  if (!Icon) return null;
  return <Icon className={className} />;
}

function NavLink({
  item,
  lang,
  dict,
  isActive,
  isAdmin,
  soonLabel,
  badgeCount,
  badgeTitle,
  onClick,
}: {
  item: NavItem;
  lang: string;
  dict: Record<string, string>;
  isActive: boolean;
  isAdmin?: boolean;
  soonLabel?: string;
  badgeCount?: number;
  badgeTitle?: string;
  onClick?: () => void;
}) {
  // "Soon" items: admins get a clickable link with badge, others get a disabled span
  if (item.soon && !isAdmin) {
    return (
      <span className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-text-muted/50 cursor-default select-none">
        <NavIcon name={item.icon} className="w-4 h-4 shrink-0" />
        <span className="flex-1">{dict[item.key] ?? item.label}</span>
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-pa-green/10 text-pa-green border border-pa-green/20">
          {soonLabel ?? "Soon"}
        </span>
      </span>
    );
  }

  return (
    <Link
      href={`/${lang}${item.href}`}
      onClick={onClick}
      className={[
        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
        isActive
          ? "bg-pa-green/6 text-pa-green"
          : "text-text-muted hover:text-text-primary",
      ].join(" ")}
    >
      <NavIcon name={item.icon} className="w-4 h-4 shrink-0" />
      <span className="flex-1">{dict[item.key] ?? item.label}</span>
      {badgeCount !== undefined && badgeCount > 0 && (
        <span
          title={badgeTitle}
          aria-label={badgeTitle}
          className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40"
        >
          {badgeCount > 99 ? "99+" : badgeCount}
        </span>
      )}
      {item.soon && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-pa-green/10 text-pa-green border border-pa-green/20">
          {soonLabel ?? "Soon"}
        </span>
      )}
    </Link>
  );
}

const ADMIN_GROUP_STORAGE_PREFIX = "pa.admin.nav.";

function CollapsibleAdminGroup({
  group,
  lang,
  dict,
  badges,
  badgeTitleFor,
  isActiveItem,
  onNavClick,
}: {
  group: AdminNavGroup;
  lang: string;
  dict: Record<string, string>;
  badges?: Record<string, number>;
  badgeTitleFor: (key: string, count: number) => string | undefined;
  isActiveItem: (item: NavItem) => boolean;
  onNavClick?: () => void;
}) {
  const containsActive = group.items.some((item) => isActiveItem(item));
  const storageKey = `${ADMIN_GROUP_STORAGE_PREFIX}${group.key}`;

  // Initial state: open if route is inside this group; otherwise closed.
  // Stored preference is layered on top after mount.
  const [userOpen, setUserOpen] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored === "1" || stored === "0") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setUserOpen(stored === "1");
      }
    } catch {
      // localStorage unavailable — keep initial null
    }
  }, [storageKey]);

  const isOpen = containsActive || userOpen === true;

  function toggle() {
    const next = !isOpen;
    setUserOpen(next);
    try {
      window.localStorage.setItem(storageKey, next ? "1" : "0");
    } catch {
      // ignore
    }
  }

  const groupBadgeTotal = group.items.reduce(
    (sum, item) => sum + (badges?.[item.key] ?? 0),
    0,
  );
  const showCollapsedBadge = !isOpen && groupBadgeTotal > 0;
  const groupLabel = dict[group.key] ?? group.label;

  return (
    <li>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={isOpen}
        aria-controls={`admin-group-${group.key}`}
        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-text-muted hover:text-text-primary transition-colors"
      >
        <NavIcon name={group.icon} className="w-4 h-4 shrink-0" />
        <span className="flex-1 text-left">{groupLabel}</span>
        {showCollapsedBadge && (
          <span
            aria-label={`${groupBadgeTotal} offen`}
            className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40"
          >
            {groupBadgeTotal > 99 ? "99+" : groupBadgeTotal}
          </span>
        )}
        <ChevronDown
          className={[
            "w-4 h-4 shrink-0 transition-transform",
            isOpen ? "rotate-0" : "-rotate-90",
          ].join(" ")}
        />
      </button>
      {isOpen && (
        <ul id={`admin-group-${group.key}`} className="mt-1 ml-4 pl-3 border-l border-white/6 space-y-1">
          {group.items.map((item) => {
            const badgeCount = badges?.[item.key];
            return (
              <li key={item.key}>
                <NavLink
                  item={item}
                  lang={lang}
                  dict={dict}
                  isActive={isActiveItem(item)}
                  badgeCount={badgeCount}
                  badgeTitle={badgeCount ? badgeTitleFor(item.key, badgeCount) : undefined}
                  onClick={onNavClick}
                />
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

function SidebarContent({
  lang,
  dict,
  adminDict,
  dashboardDict,
  userRole,
  userName,
  userInitial,
  mode,
  badges,
  onNavClick,
}: SidebarProps & { onNavClick?: () => void }) {
  const pathname = usePathname();
  const isAdmin = userRole === "admin" || userRole === "super_admin";

  function isActiveItem(item: NavItem): boolean {
    const fullHref = `/${lang}${item.href}`;
    if (item.href === "/dashboard") {
      return pathname === fullHref;
    }
    if (item.href === "/admin") {
      return pathname === fullHref || pathname.startsWith(`${fullHref}/`);
    }
    return pathname.startsWith(fullHref);
  }

  const adminLabel = adminDict["administration"] ?? "Administration";
  const comingSoonLabel = dashboardDict["comingSoon"] ?? "Coming soon";
  const levelLabel = dashboardDict["level"] ?? "Level";

  const isDe = lang === "de";
  function badgeTitleFor(key: string, count: number): string | undefined {
    if (key === "boxes" && count > 0) {
      return isDe
        ? `${count} Box${count === 1 ? "" : "en"} pausiert und brauchen Admin-Review`
        : `${count} box${count === 1 ? "" : "es"} paused and need admin review`;
    }
    return undefined;
  }

  if (mode === "admin") {
    return (
      <>
        <nav className="flex-1 px-3 py-4">
          <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
            {adminLabel}
          </p>
          <ul className="space-y-1">
            {adminPinnedItems.map((item) => {
              const badgeCount = badges?.[item.key];
              return (
                <li key={item.key}>
                  <NavLink
                    item={item}
                    lang={lang}
                    dict={adminDict}
                    isActive={isActiveItem(item)}
                    badgeCount={badgeCount}
                    badgeTitle={badgeCount ? badgeTitleFor(item.key, badgeCount) : undefined}
                    onClick={onNavClick}
                  />
                </li>
              );
            })}
            {adminNavGroups.map((group) => (
              <CollapsibleAdminGroup
                key={group.key}
                group={group}
                lang={lang}
                dict={adminDict}
                badges={badges}
                badgeTitleFor={badgeTitleFor}
                isActiveItem={isActiveItem}
                onNavClick={onNavClick}
              />
            ))}
          </ul>
        </nav>

        {/* User card */}
        <div className="px-3 pb-4 shrink-0">
          <div className="flex items-center gap-3 px-3 py-3 rounded-lg bg-white/3 border border-white/6">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pa-green/60 to-pa-lila/60 flex items-center justify-center text-sm font-bold text-white shrink-0">
              {userInitial}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">{userName}</p>
              <p className="text-xs text-text-muted">{levelLabel} 1</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (mode === "shop") {
    const shopLabel = dashboardDict["shopManagement"] ?? "Shopverwaltung";
    return (
      <>
        <nav className="flex-1 px-3 py-4">
          <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
            {shopLabel}
          </p>
          <ul className="space-y-1">
            {shopNavItems.map((item) => (
              <li key={item.key}>
                <NavLink
                  item={item}
                  lang={lang}
                  dict={dashboardDict}
                  isActive={isActiveItem(item)}
                  onClick={onNavClick}
                />
              </li>
            ))}
          </ul>
        </nav>

        {/* User card */}
        <div className="px-3 pb-4 shrink-0">
          <div className="flex items-center gap-3 px-3 py-3 rounded-lg bg-white/3 border border-white/6">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pa-green/60 to-pa-lila/60 flex items-center justify-center text-sm font-bold text-white shrink-0">
              {userInitial}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">{userName}</p>
              <p className="text-xs text-text-muted">{levelLabel} 1</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Full mode
  const mainLabel = dict["mainMenu"] ?? "Main menu";

  return (
    <>
      {/* Logo */}
      <div className="px-6 py-5 shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/logo.svg"
          alt="PACKATTACK.gg"
          className="h-5 w-auto"
        />
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-3 pb-4 space-y-6">
        <div>
          <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
            {mainLabel}
          </p>
          <ul className="space-y-1">
            {mainNavItems
              .filter((item) => !item.adminOnly || isAdmin)
              .map((item) => (
              <li key={item.key}>
                <NavLink
                  item={item}
                  lang={lang}
                  dict={dict}
                  isActive={isActiveItem(item)}
                  isAdmin={isAdmin}
                  soonLabel={comingSoonLabel}
                  onClick={onNavClick}
                />
              </li>
            ))}
          </ul>
        </div>

        {/* Admin section */}
        {isAdmin && (
          <div>
            <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
              {adminLabel}
            </p>
            <ul className="space-y-1">
              {adminPinnedItems.map((item) => {
                const badgeCount = badges?.[item.key];
                return (
                  <li key={item.key}>
                    <NavLink
                      item={item}
                      lang={lang}
                      dict={adminDict}
                      isActive={isActiveItem(item)}
                      badgeCount={badgeCount}
                      badgeTitle={badgeCount ? badgeTitleFor(item.key, badgeCount) : undefined}
                      onClick={onNavClick}
                    />
                  </li>
                );
              })}
              {adminNavGroups.map((group) => (
                <CollapsibleAdminGroup
                  key={group.key}
                  group={group}
                  lang={lang}
                  dict={adminDict}
                  badges={badges}
                  badgeTitleFor={badgeTitleFor}
                  isActiveItem={isActiveItem}
                  onNavClick={onNavClick}
                />
              ))}
            </ul>
          </div>
        )}

        {/* Coming soon section */}
        <div>
          <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
            {comingSoonLabel}
          </p>
          <ul className="space-y-1">
            {soonNavItems.map((item) => (
              <li key={item.key}>
                <NavLink
                  item={item}
                  lang={lang}
                  dict={dict}
                  isActive={isActiveItem(item)}
                  isAdmin={isAdmin}
                  soonLabel={comingSoonLabel}
                  onClick={onNavClick}
                />
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* User card */}
      <div className="px-3 pb-4 shrink-0">
        <div className="flex items-center gap-3 px-3 py-3 rounded-lg bg-white/3 border border-white/6">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pa-green/60 to-pa-lila/60 flex items-center justify-center text-sm font-bold text-white shrink-0">
            {userInitial}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">{userName}</p>
            <p className="text-xs text-text-muted">{levelLabel} 1</p>
          </div>
        </div>
      </div>
    </>
  );
}

export function Sidebar(props: SidebarProps) {
  const { mode = "full" } = props;
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Close on route change
  const prevPathnameRef = useRef(pathname);
  useEffect(() => {
    if (prevPathnameRef.current !== pathname) {
      prevPathnameRef.current = pathname;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMobileOpen(false);
    }
  }, [pathname]);

  if (mode === "admin" || mode === "shop") {
    const mobileTitle = mode === "admin" ? "Admin" : "Shop";
    return (
      <>
        {/* Mobile toggle button */}
        <button
          onClick={() => setMobileOpen((prev) => !prev)}
          className="md:hidden fixed bottom-4 right-4 z-20 w-12 h-12 flex items-center justify-center bg-pa-green text-bg rounded-full shadow-lg"
          aria-label={mobileOpen ? "Close sidebar" : "Open sidebar"}
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* Mobile overlay */}
        {mobileOpen && (
          <div className="md:hidden fixed inset-0 z-25 flex">
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />
            <aside className="relative w-64 flex flex-col bg-gradient-to-b from-bg to-pa-lila/8 border-r border-border overflow-y-auto">
              <div className="h-14 flex items-center justify-between px-4 border-b border-border shrink-0">
                <span className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
                  {mobileTitle}
                </span>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="text-text-muted hover:text-text-primary"
                  aria-label="Close sidebar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <SidebarContent {...props} onNavClick={() => setMobileOpen(false)} />
            </aside>
          </div>
        )}

        {/* Desktop sidebar */}
        <aside className="hidden md:flex w-64 flex-col bg-gradient-to-b from-bg to-pa-lila/8 border-r border-border overflow-y-auto">
          <SidebarContent {...props} />
        </aside>
      </>
    );
  }

}
