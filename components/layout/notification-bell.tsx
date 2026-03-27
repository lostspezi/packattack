"use client";

import { Bell } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { NotificationDropdown } from "@/components/notifications/notification-dropdown";

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

  // Fetch on mount (ref flag prevents double-fetch in StrictMode)
  const didFetchRef = useRef(false);
  useEffect(() => {
    if (didFetchRef.current) return;
    didFetchRef.current = true;
    void (async () => {
      await fetchUnreadCount();
    })();
  }, [fetchUnreadCount]);

  // SSE stream for real-time unread count updates
  useEffect(() => {
    const es = new EventSource("/api/notifications/events");

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (typeof data.unreadCount === "number") {
          setUnreadCount(data.unreadCount);
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      // EventSource auto-reconnects
    };

    return () => es.close();
  }, []);

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
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-pa-green text-[10px] font-bold text-bg leading-none px-[3px]">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      <div
        className={[
          "fixed sm:absolute left-2 right-2 top-[4.5rem] sm:top-auto sm:left-auto sm:right-0 sm:mt-1 sm:w-80 bg-surface-elevated border border-border rounded-[10px] shadow-lg z-50 overflow-hidden transition-all duration-200 ease-out origin-top",
          open
            ? "opacity-100 scale-100 pointer-events-auto"
            : "opacity-0 scale-95 pointer-events-none",
        ].join(" ")}
      >
        <NotificationDropdown
          lang="en"
          dict={{}}
          open={open}
          onUnreadCountChange={handleUnreadCountChange}
        />
      </div>
    </div>
  );
}
