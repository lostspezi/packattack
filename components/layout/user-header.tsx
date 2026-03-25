"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LayoutGrid, Package, ShoppingBag, ChevronDown } from "lucide-react";
import { LanguageSwitcher } from "./language-switcher";
import { NotificationBell } from "./notification-bell";
import { UserDropdown } from "./user-dropdown";

interface UserHeaderProps {
  lang: string;
  dict: Record<string, string>;
  userName: string;
  userInitial: string;
  userImage?: string | null;
  userRole: string;
}

export function UserHeader({
  lang,
  dict,
  userName,
  userInitial,
  userImage,
  userRole,
}: UserHeaderProps) {
  const pathname = usePathname();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const dashboardHref = `/${lang}/dashboard`;
  const isDashboardActive = pathname === dashboardHref;

  const levelLabel = dict["level"] ?? "Level";

  return (
    <header className="h-16 flex items-center justify-between px-6 border-b border-border bg-surface flex-shrink-0">
      {/* Left side: logo + nav */}
      <div className="flex items-center gap-6">
        {/* Logo */}
        <Link href={dashboardHref} className="text-lg font-bold tracking-wide">
          <span className="text-pa-green">PACK</span>
          <span className="text-text-primary">ATTACK</span>
          <span className="text-pa-green">.GG</span>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-1">
          {/* Dashboard */}
          <Link
            href={dashboardHref}
            className={[
              "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              isDashboardActive
                ? "text-pa-green bg-pa-green/6"
                : "text-text-muted hover:text-text-primary",
            ].join(" ")}
          >
            <LayoutGrid className="w-4 h-4 flex-shrink-0" />
            <span>{dict["dashboard"] ?? "Dashboard"}</span>
          </Link>

          {/* Packs — soon */}
          <span className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium opacity-35 cursor-default select-none text-text-muted">
            <Package className="w-4 h-4 flex-shrink-0" />
            <span>{dict["packs"] ?? "Packs"}</span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-pa-green/10 text-pa-green border border-pa-green/20">
              Soon
            </span>
          </span>

          {/* Marketplace — soon */}
          <span className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium opacity-35 cursor-default select-none text-text-muted">
            <ShoppingBag className="w-4 h-4 flex-shrink-0" />
            <span>{dict["marketplace"] ?? "Marketplace"}</span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-pa-green/10 text-pa-green border border-pa-green/20">
              Soon
            </span>
          </span>
        </nav>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        <LanguageSwitcher lang={lang} />
        <NotificationBell />

        {/* User dropdown trigger */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen((prev) => !prev)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/4 transition-colors"
          >
            {/* Avatar */}
            <img
              src={userImage || "/images/default-avatar.png"}
              alt={userName}
              width={32}
              height={32}
              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
            />
            {/* Name + level */}
            <div className="text-left hidden sm:block">
              <p className="text-sm font-medium text-text-primary leading-tight">{userName}</p>
              <p className="text-xs text-text-muted leading-tight">{levelLabel} 1</p>
            </div>
            <ChevronDown className="w-4 h-4 text-text-muted" />
          </button>

          {dropdownOpen && (
            <UserDropdown
              lang={lang}
              dict={dict}
              userRole={userRole}
              onClose={() => setDropdownOpen(false)}
            />
          )}
        </div>
      </div>
    </header>
  );
}
