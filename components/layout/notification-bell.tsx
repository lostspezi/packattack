"use client";

import { Bell } from "lucide-react";
import { createPortal } from "react-dom";
import { useState, useEffect, useCallback, useRef, type CSSProperties } from "react";
import { NotificationDropdown } from "@/components/notifications/notification-dropdown";

interface UnreadResponse {
  unreadCount: number;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?page=1&limit=1", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data: UnreadResponse = await res.json();
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // silently ignore
    }
  }, []);

  const didFetchRef = useRef(false);
  useEffect(() => {
    if (didFetchRef.current) return;
    didFetchRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    void fetchUnreadCount();
  }, [fetchUnreadCount]);

  const sseConnectedRef = useRef(false);

  useEffect(() => {
    const es = new EventSource("/api/notifications/events");

    es.onopen = () => {
      sseConnectedRef.current = true;
    };

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
      sseConnectedRef.current = false;
    };

    return () => {
      sseConnectedRef.current = false;
      es.close();
    };
  }, []);

  useEffect(() => {
    function onFocus() {
      // Only fetch on focus if SSE is disconnected (avoids redundant calls)
      if (!sseConnectedRef.current) {
        void fetchUnreadCount();
      }
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (!open) return;

    function updatePosition() {
      const trigger = buttonRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const width = Math.min(320, window.innerWidth - 16);
      const left = Math.max(8, rect.right - width);
      setDropdownStyle({
        position: "fixed",
        top: rect.bottom + 8,
        left,
        width,
        zIndex: 80,
      });
    }

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
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
  }, [open]);

  function handleUnreadCountChange(count: number) {
    setUnreadCount(count);
  }

  const dropdown =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={dropdownRef}
            style={dropdownStyle}
            className="overflow-hidden rounded-[10px] border border-border bg-surface-elevated shadow-xl shadow-black/30"
          >
            <NotificationDropdown
              lang="en"
              dict={{}}
              open={open}
              unreadCount={unreadCount}
              onUnreadCountChange={handleUnreadCountChange}
            />
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen((prev) => !prev)}
        className="relative rounded-lg p-2 text-text-muted transition-colors hover:text-text-primary"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-pa-green px-[3px] text-[10px] font-bold leading-none text-bg">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {dropdown}
    </div>
  );
}
