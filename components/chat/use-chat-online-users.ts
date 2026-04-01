"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatOnlineUserSummary, ChatOnlineUsersResponse } from "@/types/chat";

export function useChatOnlineUsers(
  open: boolean,
  onlineCount: number,
  loadErrorText: string
) {
  const [users, setUsers] = useState<ChatOnlineUserSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadErrorTextRef = useRef(loadErrorText);
  loadErrorTextRef.current = loadErrorText;

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
      setError(loadErrorTextRef.current);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void refreshOnlineUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return {
    error,
    loading,
    refreshOnlineUsers,
    users,
  };
}
