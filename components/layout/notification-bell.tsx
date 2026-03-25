"use client";

import { Bell } from "lucide-react";

export function NotificationBell() {
  return (
    <button
      className="relative p-2 rounded-lg text-text-muted hover:text-text-primary transition-colors"
      aria-label="Notifications"
    >
      <Bell className="w-5 h-5" />
      <span className="absolute top-1 right-1 w-4 h-4 flex items-center justify-center rounded-full bg-pa-green text-[10px] font-bold text-bg leading-none">
        0
      </span>
    </button>
  );
}
