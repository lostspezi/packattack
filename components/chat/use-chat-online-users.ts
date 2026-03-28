"use client";

import { useCallback, useEffect, useState } from "react";
import type { ChatOnlineUserSummary, ChatOnlineUsersResponse } from "@/types/chat";

export function useChatOnlineUsers(
  open: boolean,
  onlineCount: number,
  loadErrorText: string
) {
  const [users, setUsers] = useState<ChatOnlineUserSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshOnlineUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/chat/online", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("load_failed");
      }

      const payload = (await response.json()) as ChatOnlineUsersResponse;
      setUsers(payload.users);
    } catch {
      setError(loadErrorText);
    } finally {
      setLoading(false);
    }
  }, [loadErrorText]);

  useEffect(() => {
    if (!open) return;
    void refreshOnlineUsers();
  }, [open, onlineCount, refreshOnlineUsers]);

  return {
    error,
    loading,
    refreshOnlineUsers,
    users,
  };
}
