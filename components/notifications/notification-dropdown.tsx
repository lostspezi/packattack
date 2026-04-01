"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  NotificationItem,
  type NotificationData,
} from "./notification-item";

interface NotificationDropdownProps {
  lang: string;
  dict: Record<string, string>;
  open?: boolean;
  unreadCount?: number;
  onUnreadCountChange?: (count: number) => void;
}

interface NotificationsResponse {
  notifications: NotificationData[];
  unreadCount: number;
  total: number;
}

export function NotificationDropdown({
  lang,
  dict,
  open,
  unreadCount,
  onUnreadCountChange,
}: NotificationDropdownProps) {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const lastLoadedUnreadRef = useRef<number | null>(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?page=1&limit=20", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data: NotificationsResponse = await res.json();
      setNotifications(data.notifications);
      onUnreadCountChange?.(data.unreadCount);
      lastLoadedUnreadRef.current = data.unreadCount ?? 0;
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, [onUnreadCountChange]);

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (open) {
      void fetchNotifications();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keep the open dropdown list in sync with realtime unread updates (debounced).
  const refetchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  useEffect(() => {
    if (!open || typeof unreadCount !== "number") return;
    if (lastLoadedUnreadRef.current === null) return;
    if (unreadCount !== lastLoadedUnreadRef.current) {
      if (refetchTimeoutRef.current) clearTimeout(refetchTimeoutRef.current);
      refetchTimeoutRef.current = setTimeout(() => {
        void fetchNotifications();
      }, 500);
    }
    return () => {
      if (refetchTimeoutRef.current) clearTimeout(refetchTimeoutRef.current);
    };
  }, [open, unreadCount, fetchNotifications]);

  async function handleMarkRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "markRead", id }),
      });
      if (res.ok) {
        const newUnread = notifications.filter(
          (n) => !n.read && n.id !== id
        ).length;
        onUnreadCountChange?.(newUnread);
      }
    } catch {
      // silently ignore
    }
  }

  async function handleMarkAllRead() {
    if (markingAll) return;
    setMarkingAll(true);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    onUnreadCountChange?.(0);
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "markAllRead" }),
      });
    } catch {
      // silently ignore
    } finally {
      setMarkingAll(false);
    }
  }

  async function handleDelete(id: string) {
    const isUnread = notifications.some((n) => n.id === id && !n.read);
    setNotifications((prev) => prev.filter((n) => n.id !== id));

    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });

      if (res.ok && isUnread) {
        const newUnread = Math.max(
          0,
          notifications.filter((n) => !n.read && n.id !== id).length
        );
        onUnreadCountChange?.(newUnread);
      }
    } catch {
      // silently ignore
    }
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-sm font-semibold text-text-primary">
          {dict["notifications.title"] ?? "Notifications"}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleMarkAllRead}
          loading={markingAll}
          className="text-xs"
        >
          {dict["notifications.markAllRead"] ?? "Mark all as read"}
        </Button>
      </div>

      {/* List */}
      <div className="overflow-y-auto max-h-[400px]">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <span className="inline-block w-5 h-5 border-2 border-pa-green border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-sm text-text-muted">
            {dict["notifications.empty"] ?? "No notifications"}
          </div>
        ) : (
          notifications.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              lang={lang}
              dict={dict}
              onMarkRead={handleMarkRead}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}
