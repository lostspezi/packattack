"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  LayoutGrid,
  Package,
  Swords,
  Trophy,
  ShoppingBag,
  ShoppingCart,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";
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
  const userMenuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function onAvatarChange(e: Event) {
      const detail = (e as CustomEvent<{ url: string | null }>).detail;
      setAvatarUrl(detail.url || "/images/default-avatar.png");
    }
    window.addEventListener("avatar-changed", onAvatarChange);
    return () => window.removeEventListener("avatar-changed", onAvatarChange);
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect -- syncing avatar state from prop */
  useEffect(() => {
    setAvatarUrl(userImage || "/images/default-avatar.png");
  }, [userImage]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const [cartCount, setCartCount] = useState(0);
  const [cartTimer, setCartTimer] = useState(0);

  const fetchCartCount = useCallback(() => {
    fetch("/api/cart")
      .then((r) => r.json())
      .then((data) => {
        setCartCount(data.totalItems ?? 0);
        setCartTimer(data.cartExpiresInSeconds ?? 0);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchCartCount();
  }, [fetchCartCount]);

  // Close mobile menu and refresh cart on navigation
  const pathnameWithoutLang = pathname.replace(/^\/[a-z]{2}/, "");
  /* eslint-disable react-hooks/set-state-in-effect -- closing menu and refreshing cart on route change */
  useEffect(() => {
    setMobileMenuOpen(false);
    fetchCartCount();
  }, [pathnameWithoutLang, fetchCartCount]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Tick cart timer every second
  useEffect(() => {
    if (cartTimer <= 0) return;
    const interval = setInterval(() => {
      setCartTimer((prev) => {
        const next = Math.max(0, prev - 1);
        if (next === 0) fetchCartCount();
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [cartTimer, fetchCartCount]);

  function formatTimer(seconds: number) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function timerColor(seconds: number) {
    if (seconds <= 600) return "text-red-400"; // < 10 min
    if (seconds <= 1800) return "text-orange-400"; // < 30 min
    if (seconds <= 3600) return "text-amber-400"; // < 1h
    return "text-text-muted"; // > 1h
  }

  const dashboardHref = `/${lang}/dashboard`;
  const isDashboardActive = pathname === dashboardHref;
  const levelLabel = dict["level"] ?? "Level";

  return (
    <>
      <header className="relative z-40 flex h-16 shrink-0 items-center justify-between border-b border-border bg-surface px-4 md:px-6">
        <div className="flex items-center gap-3 md:gap-6">
          <button
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="shrink-0 rounded-lg p-2 text-text-muted transition-colors hover:text-text-primary md:hidden"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <Link href={dashboardHref} className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/logo.svg" alt="PackAttack.gg" className="h-5 w-auto sm:h-6" />
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            <Link
              href={dashboardHref}
              className={[
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isDashboardActive
                  ? "bg-pa-green/6 text-pa-green"
                  : "text-text-muted hover:text-text-primary",
              ].join(" ")}
            >
              <LayoutGrid className="h-4 w-4 shrink-0" />
              <span>{dict["dashboard"] ?? "Dashboard"}</span>
            </Link>

            <Link
              href={`/${lang}/packs`}
              className={[
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                pathname.includes("/packs")
                  ? "bg-white/6 text-pa-green"
                  : "text-text-secondary hover:bg-white/4 hover:text-text-primary",
              ].join(" ")}
            >
              <Package className="h-4 w-4 shrink-0" />
              <span>{dict["packs"] ?? "Packs"}</span>
            </Link>

            <Link
              href={`/${lang}/battles`}
              className={[
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                pathname.includes("/battles")
                  ? "bg-white/6 text-pa-green"
                  : "text-text-secondary hover:bg-white/4 hover:text-text-primary",
              ].join(" ")}
            >
              <Swords className="h-4 w-4 shrink-0" />
              <span>{dict["battles"] ?? "Battles"}</span>
            </Link>

            <Link
              href={`/${lang}/leaderboard`}
              className={[
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                pathname.includes("/leaderboard")
                  ? "bg-white/6 text-pa-green"
                  : "text-text-secondary hover:bg-white/4 hover:text-text-primary",
              ].join(" ")}
            >
              <Trophy className="h-4 w-4 shrink-0" />
              <span>{dict["leaderboard"] ?? "Bestenliste"}</span>
            </Link>

            <Link
              href={`/${lang}/cart`}
              className={[
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                pathname.startsWith(`/${lang}/cart`)
                  ? "bg-white/6 text-pa-green"
                  : "text-text-secondary hover:bg-white/4 hover:text-text-primary",
              ].join(" ")}
            >
              <ShoppingCart className="h-4 w-4 shrink-0" />
              <span>{dict["cart"] ?? "Warenkorb"}</span>
              {cartCount > 0 && (
                <>
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-pa-green px-1.5 text-[10px] font-bold text-black">
                    {cartCount}
                  </span>
                  <span className={`font-mono text-xs ${timerColor(cartTimer)}`}>
                    {formatTimer(cartTimer)}
                  </span>
                </>
              )}
            </Link>

            <span className="select-none rounded-lg px-3 py-2 text-sm font-medium text-text-muted opacity-35">
              <span className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 shrink-0" />
                <span>{dict["marketplace"] ?? "Marktplatz"}</span>
                <span className="inline-flex items-center rounded border border-pa-green/20 bg-pa-green/10 px-1.5 py-0.5 text-[10px] font-semibold text-pa-green">
                  Soon
                </span>
              </span>
            </span>
          </nav>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <div className="hidden sm:block">
            <LanguageSwitcher lang={lang} languages={languages} />
          </div>
          <div className="hidden sm:block">
            <NotificationBell />
          </div>
          <CoinBalance />

          <div className="relative">
            <button
              ref={userMenuButtonRef}
              onClick={() => setDropdownOpen((prev) => !prev)}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/4"
            >
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
              <div className="hidden text-left sm:block">
                <p className="leading-tight text-sm font-medium text-text-primary">{userName}</p>
                <p className="leading-tight text-xs text-text-muted">{levelLabel} 1</p>
              </div>
              <ChevronDown className="hidden h-4 w-4 text-text-muted sm:block" />
            </button>

            <UserDropdown
              lang={lang}
              dict={dict}
              userRole={userRole}
              open={dropdownOpen}
              onClose={() => setDropdownOpen(false)}
              anchorRef={userMenuButtonRef}
            />
          </div>
        </div>
      </header>

      <div
        className="fixed inset-0 z-70 flex md:hidden"
        style={{
          visibility: mobileMenuOpen ? "visible" : "hidden",
          transition: mobileMenuOpen ? "visibility 0s" : "visibility 0s 0.3s",
        }}
      >
        <div
          className={[
            "absolute inset-0 bg-black/60 transition-opacity duration-300",
            mobileMenuOpen ? "opacity-100" : "opacity-0",
          ].join(" ")}
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />

        <div
          className={[
            "relative flex w-72 max-w-[85vw] flex-col overflow-y-auto border-r border-border bg-surface transition-transform duration-300 ease-out",
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
          ].join(" ")}
        >
          <div className="flex h-16 shrink-0 items-center border-b border-border px-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/logo.svg" alt="PackAttack.gg" className="h-5 w-auto" />
          </div>

          <nav className="flex-1 space-y-1 px-3 py-4">
            <Link
              href={dashboardHref}
              onClick={() => setMobileMenuOpen(false)}
              className={[
                "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                isDashboardActive
                  ? "bg-pa-green/6 text-pa-green"
                  : "text-text-muted hover:text-text-primary",
              ].join(" ")}
            >
              <LayoutGrid className="h-5 w-5 shrink-0" />
              <span>{dict["dashboard"] ?? "Dashboard"}</span>
            </Link>

            <Link
              href={`/${lang}/packs`}
              onClick={() => setMobileMenuOpen(false)}
              className={[
                "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                pathname.includes("/packs")
                  ? "bg-pa-green/6 text-pa-green"
                  : "text-text-muted hover:text-text-primary",
              ].join(" ")}
            >
              <Package className="h-5 w-5 shrink-0" />
              <span>{dict["packs"] ?? "Packs"}</span>
            </Link>

            <Link
              href={`/${lang}/battles`}
              onClick={() => setMobileMenuOpen(false)}
              className={[
                "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                pathname.includes("/battles")
                  ? "bg-pa-green/6 text-pa-green"
                  : "text-text-muted hover:text-text-primary",
              ].join(" ")}
            >
              <Swords className="h-5 w-5 shrink-0" />
              <span className="flex-1">{dict["battles"] ?? "Battles"}</span>
            </Link>

            <Link
              href={`/${lang}/leaderboard`}
              onClick={() => setMobileMenuOpen(false)}
              className={[
                "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                pathname.includes("/leaderboard")
                  ? "bg-pa-green/6 text-pa-green"
                  : "text-text-muted hover:text-text-primary",
              ].join(" ")}
            >
              <Trophy className="h-5 w-5 shrink-0" />
              <span className="flex-1">{dict["leaderboard"] ?? "Bestenliste"}</span>
            </Link>

            <Link
              href={`/${lang}/cart`}
              onClick={() => setMobileMenuOpen(false)}
              className={[
                "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                pathname.startsWith(`/${lang}/cart`)
                  ? "bg-pa-green/6 text-pa-green"
                  : "text-text-muted hover:text-text-primary",
              ].join(" ")}
            >
              <ShoppingCart className="h-5 w-5 shrink-0" />
              <span className="flex-1">{dict["cart"] ?? "Warenkorb"}</span>
              {cartCount > 0 && (
                <>
                  <span className={`font-mono text-xs ${timerColor(cartTimer)}`}>
                    {formatTimer(cartTimer)}
                  </span>
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-pa-green px-1.5 text-[10px] font-bold text-black">
                    {cartCount}
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
    </>
  );
}
