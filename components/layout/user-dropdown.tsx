"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { User, Settings, Shield, BarChart3, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

interface UserDropdownProps {
  lang: string;
  dict: Record<string, string>;
  userRole: string;
  onClose: () => void;
}

export function UserDropdown({ lang, dict: _dict, userRole, onClose }: UserDropdownProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isAdmin = userRole === "admin" || userRole === "super_admin";

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const itemClass =
    "flex items-center gap-[10px] px-3 py-2.5 rounded-lg hover:bg-white/3 transition-colors text-sm text-text-primary w-full text-left";

  return (
    <div
      ref={ref}
      className="absolute top-full right-0 mt-1 w-52 bg-surface border border-border rounded-xl shadow-lg p-2 z-50"
    >
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

      {isAdmin && (
        <>
          <div className="my-1 h-px bg-border" />
          <Link
            href={`/${lang}/admin`}
            onClick={onClose}
            className={itemClass}
          >
            <BarChart3 className="w-4 h-4 flex-shrink-0 text-text-muted" />
            <span>Admin Panel</span>
          </Link>
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
