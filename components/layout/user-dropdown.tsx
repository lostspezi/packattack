"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { User, Settings, Shield, BarChart3, Store, LogOut, Bell } from "lucide-react";
import { signOut } from "next-auth/react";

interface UserDropdownProps {
  lang: string;
  dict: Record<string, string>;
  userRole: string;
  open: boolean;
  onClose: () => void;
}

export function UserDropdown({ lang, dict: _dict, userRole, open, onClose }: UserDropdownProps) {
  void _dict;
  const ref = useRef<HTMLDivElement>(null);
  const isAdmin = userRole === "admin" || userRole === "super_admin";

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      // Don't close if clicking inside the dropdown
      if (ref.current && ref.current.contains(target)) return;
      // Don't close if clicking the trigger button (parent handles toggle)
      const trigger = ref.current?.parentElement?.querySelector("button");
      if (trigger && trigger.contains(target)) return;
      onClose();
    }
    // Use click instead of mousedown to avoid race with button toggle
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [onClose, open]);

  const itemClass =
    "flex items-center gap-[10px] px-3 py-2.5 rounded-lg hover:bg-white/3 transition-colors text-sm text-text-primary w-full text-left";

  return (
    <div
      ref={ref}
      className={[
        "absolute top-full right-0 mt-1 w-[calc(100vw-2rem)] max-w-[13rem] bg-surface border border-border rounded-xl shadow-lg p-2 z-50 transition-all duration-200 ease-out origin-top-right",
        open
          ? "opacity-100 scale-100 pointer-events-auto"
          : "opacity-0 scale-95 pointer-events-none",
      ].join(" ")}
    >
      {/* Notifications — mobile only */}
      <Link
        href={`/${lang}/dashboard`}
        onClick={onClose}
        className={`${itemClass} sm:hidden`}
      >
        <Bell className="w-4 h-4 flex-shrink-0 text-text-muted" />
        <span>Benachrichtigungen</span>
      </Link>

      <div className="my-1 h-px bg-border sm:hidden" />

      <Link
        href={`/${lang}/profile`}
        onClick={onClose}
        className={itemClass}
      >
        <User className="w-4 h-4 flex-shrink-0 text-text-muted" />
        <span>Profil</span>
      </Link>

      <Link
        href={`/${lang}/settings`}
        onClick={onClose}
        className={itemClass}
      >
        <Settings className="w-4 h-4 flex-shrink-0 text-text-muted" />
        <span>Einstellungen</span>
      </Link>

      <Link
        href={`/${lang}/account`}
        onClick={onClose}
        className={itemClass}
      >
        <Shield className="w-4 h-4 flex-shrink-0 text-text-muted" />
        <span>Account</span>
      </Link>

      {(isAdmin || userRole === "shop") && (
        <>
          <div className="my-1 h-px bg-border" />
          {userRole === "shop" && (
            <Link
              href={`/${lang}/shop/inventory`}
              onClick={onClose}
              className={itemClass}
            >
              <Store className="w-4 h-4 flex-shrink-0 text-text-muted" />
              <span>Shopverwaltung</span>
            </Link>
          )}
          {isAdmin && (
            <Link
              href={`/${lang}/admin`}
              onClick={onClose}
              className={itemClass}
            >
              <BarChart3 className="w-4 h-4 flex-shrink-0 text-text-muted" />
              <span>Admin Panel</span>
            </Link>
          )}
        </>
      )}

      <div className="my-1 h-px bg-border" />

      <button
        onClick={() => {
          onClose();
          signOut({ callbackUrl: `/${lang}/login` });
        }}
        className={`${itemClass} text-red-400 hover:text-red-300`}
      >
        <LogOut className="w-4 h-4 flex-shrink-0" />
        <span>Abmelden</span>
      </button>
    </div>
  );
}
