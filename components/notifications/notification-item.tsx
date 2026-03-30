"use client";

import { CheckCircle, XCircle, Info, AlertTriangle, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export interface NotificationData {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  cta: { label: string; url: string } | null;
  read: boolean;
  createdAt: string | Date;
}

interface NotificationItemProps {
  notification: NotificationData;
  lang: string;
  dict: Record<string, string>;
  onMarkRead: (id: string) => void;
  onDelete?: (id: string) => void;
}

const typeConfig = {
  success: {
    icon: CheckCircle,
    color: "text-green-400",
  },
  error: {
    icon: XCircle,
    color: "text-red-400",
  },
  info: {
    icon: Info,
    color: "text-blue-400",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-yellow-400",
  },
};

function timeAgo(date: string | Date): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour !== 1 ? "s" : ""} ago`;
  return `${diffDay} day${diffDay !== 1 ? "s" : ""} ago`;
}

export function NotificationItem({
  notification,
  dict: _dict,
  onMarkRead,
  onDelete,
}: NotificationItemProps) {
  void _dict;
  const { icon: Icon, color } = typeConfig[notification.type] ?? typeConfig.info;

  function handleClick() {
    if (!notification.read) {
      onMarkRead(notification.id);
    }
  }

  return (
    <div
      onClick={handleClick}
      className={[
        "group relative flex gap-3 px-4 py-3 cursor-pointer hover:bg-white/4 transition-colors",
        !notification.read ? "border-l-2 border-pa-green" : "border-l-2 border-transparent",
      ].join(" ")}
    >
      <div className={["mt-0.5 flex-shrink-0", color].join(" ")}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0 pr-6">
        <p className="text-sm font-semibold text-text-primary truncate">
          {notification.title}
        </p>
        <p className="text-xs text-text-muted mt-0.5 line-clamp-2">
          {notification.message}
        </p>
        {notification.cta && (
          <Link
            href={notification.cta.url}
            onClick={(e) => e.stopPropagation()}
          >
            <Button variant="primary" size="sm" className="mt-2 text-xs py-1 px-2">
              {notification.cta.label}
            </Button>
          </Link>
        )}
        <p className="text-[11px] text-text-muted mt-1">
          {timeAgo(notification.createdAt)}
        </p>
      </div>

      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(notification.id);
          }}
          className="absolute right-3 top-3 rounded p-1 text-text-muted opacity-0 transition-colors hover:bg-white/10 hover:text-white group-hover:opacity-100 focus:opacity-100"
          title="Dismiss notification"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
