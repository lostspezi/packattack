"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  NotificationItem,
  type NotificationData,
} from "./notification-item";

interface NotificationDropdownProps {
  lang: string;
  dict: Record<string, string>;
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
  onUnreadCountChange,
}: NotificationDropdownProps) {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?page=1&limit=20");
      if (!res.ok) return;
      const data: NotificationsResponse = await res.json();
      setNotifications(data.notifications);
      onUnreadCountChange?.(data.unreadCount);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, [onUnreadCountChange]);

  // Called by parent when dropdown opens
  // expose via ref pattern would be cleanest, but parent passes a callback — parent
  // can simply call fetchNotifications by importing; here we auto-fetch on mount via
  // the parent rendering this component only when open.
  // We use a stable ref trick: fetch on first render of this component.
  const [fetched, setFetched] = useState(false);
  if (!fetched) {
    setFetched(true);
    // Defer to avoid calling setState during render
    Promise.resolve().then(fetchNotifications);
  }

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
            />
          ))
        )}
      </div>
    </div>
  );
}
