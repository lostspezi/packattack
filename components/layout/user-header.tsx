"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { LayoutGrid, Package, ShoppingBag, Layers, ChevronDown, Menu, X } from "lucide-react";
import { LanguageSwitcher } from "./language-switcher";
import { NotificationBell } from "./notification-bell";
import { UserDropdown } from "./user-dropdown";
import { CoinBalance } from "./coin-balance";

interface UserHeaderProps {
  lang: string;
  dict: Record<string, string>;
  languages: { code: string; name: string }[];
  userName: string;
  userImage?: string | null;
  userRole: string;
}

export function UserHeader({
  lang,
  dict,
  languages,
  userName,
  userImage,
  userRole,
}: UserHeaderProps) {
  const pathname = usePathname();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(userImage || "/images/default-avatar.png");

  useEffect(() => {
    function onAvatarChange(e: Event) {
      const detail = (e as CustomEvent<{ url: string | null }>).detail;
      setAvatarUrl(detail.url || "/images/default-avatar.png");
    }
    window.addEventListener("avatar-changed", onAvatarChange);
    return () => window.removeEventListener("avatar-changed", onAvatarChange);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAvatarUrl(userImage || "/images/default-avatar.png");
  }, [userImage]);

  // Close mobile menu on route change (but not on language switch)
  const pathnameWithoutLang = pathname.replace(/^\/[a-z]{2}/, "");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileMenuOpen(false);
  }, [pathnameWithoutLang]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  const dashboardHref = `/${lang}/dashboard`;
  const isDashboardActive = pathname === dashboardHref;

  const levelLabel = dict["level"] ?? "Level";

  return (
    <>
      <header className="h-16 flex items-center justify-between px-4 md:px-6 border-b border-border bg-surface flex-shrink-0 relative z-40">
        {/* Left side: hamburger (mobile) + logo + nav (desktop) */}
        <div className="flex items-center gap-3 md:gap-6">
          {/* Hamburger button — mobile only */}
          <button
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden p-2 rounded-lg text-text-muted hover:text-text-primary transition-colors flex-shrink-0"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>

          {/* Logo */}
          <Link href={dashboardHref} className="flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/logo.svg"
              alt="PackAttack.gg"
              className="h-5 sm:h-6 w-auto"
            />
          </Link>

          {/* Desktop Nav links */}
          <nav className="hidden md:flex items-center gap-1">
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

            {/* Packs */}
            <Link
              href={`/${lang}/packs`}
              className={[
                "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                pathname.includes("/packs")
                  ? "bg-white/6 text-pa-green"
                  : "text-text-secondary hover:text-text-primary hover:bg-white/4",
              ].join(" ")}
            >
              <Package className="w-4 h-4 flex-shrink-0" />
              <span>{dict["packs"] ?? "Packs"}</span>
            </Link>

            {/* Claimed / Collection */}
            <Link
              href={`/${lang}/claimed`}
              className={[
                "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                pathname.startsWith(`/${lang}/claimed`)
                  ? "bg-white/6 text-pa-green"
                  : "text-text-secondary hover:text-text-primary hover:bg-white/4",
              ].join(" ")}
            >
              <Layers className="w-4 h-4 flex-shrink-0" />
              <span>{dict["claimed"] ?? "Sammlung"}</span>
            </Link>

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
        <div className="flex items-center gap-2 md:gap-3">
          <div className="hidden sm:block">
            <LanguageSwitcher lang={lang} languages={languages} />
          </div>
          <div className="hidden sm:block">
            <NotificationBell />
          </div>
          <CoinBalance />

          {/* User dropdown trigger */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen((prev) => !prev)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/4 transition-colors"
            >
              {/* Avatar */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarUrl}
                alt={userName}
                width={32}
                height={32}
                className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).src = "/images/default-avatar.png"; }}
              />
              {/* Name + level — hidden on mobile */}
              <div className="text-left hidden sm:block">
                <p className="text-sm font-medium text-text-primary leading-tight">{userName}</p>
                <p className="text-xs text-text-muted leading-tight">{levelLabel} 1</p>
              </div>
              <ChevronDown className="w-4 h-4 text-text-muted hidden sm:block" />
            </button>

            <UserDropdown
              lang={lang}
              dict={dict}
              userRole={userRole}
              open={dropdownOpen}
              onClose={() => setDropdownOpen(false)}
            />
          </div>
        </div>
      </header>

      {/* Mobile menu overlay — always in DOM for animation */}
      <div
        className="md:hidden fixed inset-0 z-30 flex"
        style={{
          visibility: mobileMenuOpen ? "visible" : "hidden",
          transition: mobileMenuOpen ? "visibility 0s" : "visibility 0s 0.3s",
        }}
      >
        {/* Backdrop */}
        <div
          className={[
            "absolute inset-0 bg-black/60 transition-opacity duration-300",
            mobileMenuOpen ? "opacity-100" : "opacity-0",
          ].join(" ")}
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />

        {/* Drawer */}
        <div
          className={[
            "relative w-72 max-w-[85vw] bg-surface border-r border-border flex flex-col overflow-y-auto transition-transform duration-300 ease-out",
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
          ].join(" ")}
        >
            {/* Drawer header */}
            <div className="h-16 flex items-center px-4 border-b border-border flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/logo.svg"
                alt="PackAttack.gg"
                className="h-5 w-auto"
              />
            </div>

            {/* Nav items */}
            <nav className="flex-1 px-3 py-4 space-y-1">
              <Link
                href={dashboardHref}
                onClick={() => setMobileMenuOpen(false)}
                className={[
                  "flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors",
                  isDashboardActive
                    ? "text-pa-green bg-pa-green/6"
                    : "text-text-muted hover:text-text-primary",
                ].join(" ")}
              >
                <LayoutGrid className="w-5 h-5 flex-shrink-0" />
                <span>{dict["dashboard"] ?? "Dashboard"}</span>
              </Link>

              <Link
                href={`/${lang}/packs`}
                onClick={() => setMobileMenuOpen(false)}
                className={[
                  "flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors",
                  pathname.includes("/packs")
                    ? "text-pa-green bg-pa-green/6"
                    : "text-text-muted hover:text-text-primary",
                ].join(" ")}
              >
                <Package className="w-5 h-5 flex-shrink-0" />
                <span>{dict["packs"] ?? "Packs"}</span>
              </Link>

              <Link
                href={`/${lang}/claimed`}
                onClick={() => setMobileMenuOpen(false)}
                className={[
                  "flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors",
                  pathname.startsWith(`/${lang}/claimed`)
                    ? "text-pa-green bg-pa-green/6"
                    : "text-text-muted hover:text-text-primary",
                ].join(" ")}
              >
                <Layers className="w-5 h-5 flex-shrink-0" />
                <span>{dict["claimed"] ?? "Sammlung"}</span>
              </Link>

              <span className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium opacity-35 cursor-default select-none text-text-muted">
                <ShoppingBag className="w-5 h-5 flex-shrink-0" />
                <span className="flex-1">{dict["marketplace"] ?? "Marketplace"}</span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-pa-green/10 text-pa-green border border-pa-green/20">
                  Soon
                </span>
              </span>
            </nav>

            {/* Language switcher in drawer */}
            <div className="px-3 py-3 border-t border-border">
              <div className="flex items-center justify-between px-3">
                <span className="text-sm text-text-muted">{dict["language"] ?? "Language"}</span>
                <LanguageSwitcher lang={lang} languages={languages} />
              </div>
            </div>

            {/* User info at bottom of drawer */}
            <div className="px-3 pb-6 flex-shrink-0">
              <div className="flex items-center gap-3 px-3 py-3 rounded-lg bg-white/3 border border-white/6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatarUrl}
                  alt={userName}
                  width={32}
                  height={32}
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).src = "/images/default-avatar.png"; }}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{userName}</p>
                  <p className="text-xs text-text-muted">{levelLabel} 1</p>
                </div>
              </div>
            </div>
          </div>
      </div>
    </>
  );
}
