"use client";

import React, { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import type { BadgeVariant } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";

interface NotificationHistoryItem {
  _id: string;
  title: string;
  type: "info" | "success" | "warning" | "error";
  createdAt: string;
  count: number;
}

const TYPE_VARIANT_MAP: Record<string, BadgeVariant> = {
  success: "success",
  warning: "warning",
  error: "error",
  info: "info",
};

export function NotificationHistory() {
  const [items, setItems] = useState<NotificationHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchHistory() {
      try {
        const res = await fetch("/api/admin/notifications/history");
        if (!res.ok) {
          toast({ type: "error", title: "Failed to load history" });
          return;
        }
        const data = await res.json();
        setItems(data.items ?? []);
      } catch {
        toast({ type: "error", title: "Network error" });
      } finally {
        setLoading(false);
      }
    }
    void fetchHistory();
  }, [toast]);

  function formatDate(d: string) {
    try {
      return new Date(d).toLocaleString();
    } catch {
      return d;
    }
  }

  return (
    <div className="bg-surface border border-border rounded-[14px] p-6 space-y-4">
      <h3 className="text-base font-semibold text-text-primary">
        Recent Notifications
      </h3>

      {loading ? (
        <p className="text-sm text-text-muted py-4 text-center">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-text-muted py-4 text-center">
          No notifications sent yet.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li key={item._id} className="py-3 flex items-start gap-3">
              <Badge variant={TYPE_VARIANT_MAP[item.type] ?? "default"}>
                {item.type}
              </Badge>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">
                  {item.title}
                </p>
                <p className="text-xs text-text-muted mt-0.5">
                  {formatDate(item.createdAt)}
                  {item.count > 1 && (
                    <span className="ml-2 text-text-muted">
                      &times; {item.count} recipients
                    </span>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
