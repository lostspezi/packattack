"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Menu, X, ChevronDown } from "lucide-react";
import { LanguageSwitcher } from "../language-switcher";
import { NotificationBell } from "../notification-bell";
import { UserDropdown } from "../user-dropdown";
import { CoinBalance } from "../coin-balance";
import { useMe } from "../me-provider";
import { HeaderNav } from "./header-nav";
import { MegaMenu, type MegaMenuSection } from "./mega-menu";
import { MobileDrawer } from "./mobile-drawer";
import { useCartState } from "./use-cart-state";

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
  const cartState = useCartState();
  const { refreshCart } = cartState;
  const me = useMe();
  const userLevel = me?.level ?? 1;

  // --- Mega-menu state (lifted here so header + panel share one hover zone) ---
  const [megaMenuSection, setMegaMenuSection] = useState<MegaMenuSection>(null);
  const [megaMenuLeft, setMegaMenuLeft] = useState(24);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const activeTriggerElRef = useRef<HTMLElement | null>(null);
  const megaMenuWrapperRef = useRef<HTMLDivElement>(null);

  const openSection = useCallback((section: MegaMenuSection, triggerEl: HTMLElement) => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    activeTriggerElRef.current = triggerEl;
    setMegaMenuLeft(Math.max(triggerEl.getBoundingClientRect().left, 24));
    setMegaMenuSection(section);
  }, []);

  const startClose = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setMegaMenuSection(null);
      activeTriggerElRef.current = null;
    }, 200);
  }, []);

  const closeNow = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setMegaMenuSection(null);
    activeTriggerElRef.current = null;
  }, []);

  // Update mega-menu left position on window resize
  useEffect(() => {
    if (!megaMenuSection) return;
    function handleResize() {
      const el = activeTriggerElRef.current;
      if (el) setMegaMenuLeft(Math.max(el.getBoundingClientRect().left, 24));
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [megaMenuSection]);

  // Close mega-menu on outside tap (touch devices have no mouseLeave).
  useEffect(() => {
    if (!megaMenuSection) return;
    function handlePointerDown(e: PointerEvent) {
      const wrapper = megaMenuWrapperRef.current;
      if (wrapper && !wrapper.contains(e.target as Node)) {
        closeNow();
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [megaMenuSection, closeNow]);


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

  const pathnameWithoutLang = pathname.replace(/^\/[a-z]{2}/, "");
  /* eslint-disable react-hooks/set-state-in-effect -- closing menu and refreshing cart on route change */
  useEffect(() => {
    setMobileMenuOpen(false);
    setMegaMenuSection(null);
    refreshCart();
  }, [pathnameWithoutLang, refreshCart]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const dashboardHref = `/${lang}/dashboard`;
  const levelLabel = dict["level"] ?? "Level";

  return (
    <>
      {/*
        Shared wrapper: header bar + mega-menu panel live inside one
        relative container.  onMouseLeave on the wrapper closes the
        mega-menu, so moving the cursor from the nav item straight
        down into the panel never triggers a close.
      */}
      <div
        ref={megaMenuWrapperRef}
        className="relative z-40 shrink-0"
        onMouseLeave={startClose}
        onBlur={(e) => {
          // Close mega-menu when focus leaves the entire header zone
          if (!e.currentTarget.contains(e.relatedTarget)) closeNow();
        }}
      >
        <header
          className="flex h-16 items-center justify-between border-b border-white/8 px-4 md:h-[72px] md:px-6"
          style={{ background: "linear-gradient(150deg, var(--color-pa-blue) 10%, var(--color-pa-lila) 50%)" }}
        >
          <div className="flex items-center gap-3 md:gap-4 lg:gap-6">
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
              <img src="/images/logo.svg" alt="PACKATTACK.gg" className="h-5 w-auto lg:h-6" />
            </Link>

            <HeaderNav
              lang={lang}
              dict={dict}
              cartState={cartState}
              megaMenuSection={megaMenuSection}
              onOpenSection={openSection}
              onCloseSection={closeNow}
            />
          </div>

          <div className="flex items-center gap-2 lg:gap-3">
            <div className="hidden lg:block">
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
                aria-haspopup="true"
                aria-expanded={dropdownOpen}
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
                <div className="hidden text-left 3xl:block">
                  <p className="leading-tight text-sm font-medium text-text-primary">{userName}</p>
                  <p className="leading-tight text-xs text-text-muted">
                    {levelLabel} {userLevel}
                  </p>
                </div>
                <ChevronDown className="hidden h-4 w-4 text-text-muted 3xl:block" />
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

        {/* Mega-menu: absolute below header, inside the same hover wrapper */}
        <MegaMenu
          activeSection={megaMenuSection}
          onClose={closeNow}
          lang={lang}
          dict={dict}
          contentLeft={megaMenuLeft}
        />
      </div>

      <MobileDrawer
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        lang={lang}
        dict={dict}
        languages={languages}
        cartState={cartState}
        userName={userName}
        avatarUrl={avatarUrl}
        levelLabel={levelLabel}
      />
    </>
  );
}
