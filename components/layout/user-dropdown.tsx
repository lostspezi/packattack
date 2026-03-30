"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import {
  User,
  Settings,
  Shield,
  BarChart3,
  Store,
  LogOut,
  Bell,
  MessageSquareMore,
} from "lucide-react";
import { signOut } from "next-auth/react";

interface UserDropdownProps {
  lang: string;
  dict: Record<string, string>;
  userRole: string;
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLButtonElement | null>;
}

export function UserDropdown({
  lang,
  dict: _dict,
  userRole,
  open,
  onClose,
  anchorRef,
}: UserDropdownProps) {
  void _dict;
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({});
  const isAdmin = userRole === "admin" || userRole === "super_admin";

  useEffect(() => {
    if (!open) return;

    function updatePosition() {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const width = Math.min(208, window.innerWidth - 32);
      const left = Math.max(16, rect.right - width);

      setStyle({
        position: "fixed",
        top: rect.bottom + 8,
        left,
        width,
        zIndex: 80,
      });
    }

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    }

    updatePosition();
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchorRef, onClose, open]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  const itemClass =
    "flex items-center gap-[10px] rounded-lg px-3 py-2.5 text-left text-sm text-text-primary transition-colors hover:bg-white/3 w-full";

  return createPortal(
    <div
      ref={ref}
      style={style}
      className="rounded-xl border border-border bg-surface p-2 shadow-xl shadow-black/30"
    >
      <Link href={`/${lang}/dashboard`} onClick={onClose} className={`${itemClass} sm:hidden`}>
        <Bell className="h-4 w-4 shrink-0 text-text-muted" />
        <span>Benachrichtigungen</span>
      </Link>

      <div className="my-1 h-px bg-border sm:hidden" />

      <Link href={`/${lang}/feedback`} onClick={onClose} className={itemClass}>
        <MessageSquareMore className="h-4 w-4 shrink-0 text-text-muted" />
        <span>Feedback</span>
      </Link>

      <Link href={`/${lang}/profile`} onClick={onClose} className={itemClass}>
        <User className="h-4 w-4 shrink-0 text-text-muted" />
        <span>Profil</span>
      </Link>

      <Link href={`/${lang}/settings`} onClick={onClose} className={itemClass}>
        <Settings className="h-4 w-4 shrink-0 text-text-muted" />
        <span>Einstellungen</span>
      </Link>

      <Link href={`/${lang}/account`} onClick={onClose} className={itemClass}>
        <Shield className="h-4 w-4 shrink-0 text-text-muted" />
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
              <Store className="h-4 w-4 shrink-0 text-text-muted" />
              <span>Shopverwaltung</span>
            </Link>
          )}
          {isAdmin && (
            <Link href={`/${lang}/admin`} onClick={onClose} className={itemClass}>
              <BarChart3 className="h-4 w-4 shrink-0 text-text-muted" />
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
        <LogOut className="h-4 w-4 shrink-0" />
        <span>Abmelden</span>
      </button>
    </div>,
    document.body
  );
}
