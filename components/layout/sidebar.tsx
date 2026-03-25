"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as LucideIcons from "lucide-react";
import { mainNavItems, adminNavItems, soonNavItems, type NavItem } from "./sidebar-nav";

interface SidebarProps {
  lang: string;
  dict: Record<string, string>;
  adminDict: Record<string, string>;
  dashboardDict: Record<string, string>;
  userRole: string;
  userName: string;
  userInitial: string;
  /** "full" = original sidebar with all sections; "admin" = admin nav items only */
  mode?: "full" | "admin";
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
}: {
  item: NavItem;
  lang: string;
  dict: Record<string, string>;
  isActive: boolean;
}) {
  return (
    <Link
      href={`/${lang}${item.href}`}
      className={[
        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
        isActive
          ? "bg-pa-green/6 text-pa-green"
          : "text-text-muted hover:text-text-primary",
      ].join(" ")}
    >
      <NavIcon name={item.icon} className="w-4 h-4 flex-shrink-0" />
      <span>{dict[item.key] ?? item.key}</span>
    </Link>
  );
}

export function Sidebar({
  lang,
  dict,
  adminDict,
  dashboardDict,
  userRole,
  userName,
  userInitial,
  mode = "full",
}: SidebarProps) {
  const pathname = usePathname();

  const isAdmin = userRole === "admin" || userRole === "super_admin";

  function isActiveItem(item: NavItem): boolean {
    const fullHref = `/${lang}${item.href}`;
    if (item.href === "/dashboard") {
      return pathname === fullHref;
    }
    if (item.href === "/admin") {
      // exact match for /admin, startsWith for sub-pages
      return pathname === fullHref || pathname.startsWith(`${fullHref}/`);
    }
    return pathname.startsWith(fullHref);
  }

  const adminLabel = adminDict["administration"] ?? "Administration";
  const comingSoonLabel = dashboardDict["comingSoon"] ?? "Coming soon";
  const levelLabel = dashboardDict["level"] ?? "Level";

  if (mode === "admin") {
    // Admin-only sidebar: just the admin navigation section
    return (
      <aside className="w-64 flex flex-col bg-gradient-to-b from-bg to-pa-lila/8 border-r border-border overflow-y-auto">
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
                />
              </li>
            ))}
          </ul>
        </nav>

        {/* User card */}
        <div className="px-3 pb-4 flex-shrink-0">
          <div className="flex items-center gap-3 px-3 py-3 rounded-lg bg-white/3 border border-white/6">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pa-green/60 to-pa-lila/60 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
              {userInitial}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">{userName}</p>
              <p className="text-xs text-text-muted">{levelLabel} 1</p>
            </div>
          </div>
        </div>
      </aside>
    );
  }

  // Full mode (original behavior)
  const mainLabel = dict["mainMenu"] ?? "Main menu";

  return (
    <aside className="w-64 fixed h-screen flex flex-col bg-gradient-to-b from-bg to-pa-lila/8 border-r border-border overflow-y-auto">
      {/* Logo */}
      <div className="px-6 py-5 flex-shrink-0">
        <span className="text-xl font-bold tracking-wide">
          <span className="text-pa-green">PACK</span>
          <span className="text-text-primary">ATTACK</span>
          <span className="text-pa-green">.GG</span>
        </span>
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
                <span className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-text-muted/50 cursor-default select-none">
                  <NavIcon name={item.icon} className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1">{dict[item.key] ?? item.key}</span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-pa-green/10 text-pa-green border border-pa-green/20">
                    {comingSoonLabel}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* User card */}
      <div className="px-3 pb-4 flex-shrink-0">
        <div className="flex items-center gap-3 px-3 py-3 rounded-lg bg-white/3 border border-white/6">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pa-green/60 to-pa-lila/60 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
            {userInitial}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">{userName}</p>
            <p className="text-xs text-text-muted">{levelLabel} 1</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
