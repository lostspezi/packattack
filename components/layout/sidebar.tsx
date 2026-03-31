"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { Menu, X } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { mainNavItems, adminNavItems, shopNavItems, soonNavItems, type NavItem } from "./sidebar-nav";

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
  onClick,
}: {
  item: NavItem;
  lang: string;
  dict: Record<string, string>;
  isActive: boolean;
  isAdmin?: boolean;
  soonLabel?: string;
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
      {item.soon && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-pa-green/10 text-pa-green border border-pa-green/20">
          {soonLabel ?? "Soon"}
        </span>
      )}
    </Link>
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

  if (mode === "admin") {
    return (
      <>
        <nav className="flex-1 px-3 py-4">
          <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
            {adminLabel}
          </p>
          <ul className="space-y-1">
            {adminNavItems.map((item) => (
              <li key={item.key}>
                <NavLink
                  item={item}
                  lang={lang}
                  dict={adminDict}
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
          alt="PackAttack.gg"
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
            {mainNavItems.map((item) => (
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
              {adminNavItems.map((item) => (
                <li key={item.key}>
                  <NavLink
                    item={item}
                    lang={lang}
                    dict={adminDict}
                    isActive={isActiveItem(item)}
                    onClick={onNavClick}
                  />
                </li>
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
