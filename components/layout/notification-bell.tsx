"use client";

import { Bell } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { NotificationDropdown } from "@/components/notifications/notification-dropdown";

const POLL_INTERVAL_MS = 30_000;

interface UnreadResponse {
  unreadCount: number;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?page=1&limit=1");
      if (!res.ok) return;
      const data: UnreadResponse = await res.json();
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // silently ignore
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  // Poll every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchUnreadCount, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Refresh on window focus
  useEffect(() => {
    function onFocus() {
      fetchUnreadCount();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchUnreadCount]);

  // Click outside closes dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  function handleUnreadCountChange(count: number) {
    setUnreadCount(count);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative p-2 rounded-lg text-text-muted hover:text-text-primary transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-pa-green text-[10px] font-bold text-bg leading-none px-[3px]">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-80 bg-surface-elevated border border-border rounded-[10px] shadow-lg z-50 overflow-hidden">
          <NotificationDropdown
            lang="en"
            dict={{}}
            onUnreadCountChange={handleUnreadCountChange}
          />
        </div>
      )}
    </div>
  );
}
