"use client";

import type { KeyboardEvent, RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  findMentionQuery,
  insertMentionAtRange,
  type ChatMentionQuery,
} from "@/lib/chat-mentions";
import type { ChatMentionCandidateSummary, ChatMentionSearchResponse } from "@/types/chat";

interface UseChatMentionAutocompleteInput {
  body: string;
  disabled?: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onBodyChange: (value: string) => void;
}

export function useChatMentionAutocomplete({
  body,
  disabled = false,
  textareaRef,
  onBodyChange,
}: UseChatMentionAutocompleteInput) {
  const [caretPosition, setCaretPosition] = useState(0);
  const [range, setRange] = useState<ChatMentionQuery | null>(null);
  const [users, setUsers] = useState<ChatMentionCandidateSummary[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const requestRef = useRef(0);

  const isOpen = users.length > 0 && Boolean(range);

  const syncCaretPosition = useCallback((value?: number | null) => {
    if (typeof value === "number") {
      setCaretPosition(value);
      return;
    }

    setCaretPosition(textareaRef.current?.selectionStart ?? 0);
  }, [textareaRef]);

  const closeMentions = useCallback(() => {
    setRange(null);
    setUsers([]);
    setActiveIndex(0);
  }, []);

  useEffect(() => {
    if (disabled) {
      closeMentions();
      return;
    }

    const nextRange = findMentionQuery(body, caretPosition);
    if (!nextRange) {
      closeMentions();
      return;
    }

    setRange(nextRange);
  }, [body, caretPosition, closeMentions, disabled]);

  useEffect(() => {
    if (!range || disabled) {
      setUsers([]);
      setActiveIndex(0);
      return;
    }

    const controller = new AbortController();
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;

    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/chat/mentions?q=${encodeURIComponent(range.query)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          if (!controller.signal.aborted) {
            setUsers([]);
          }
          return;
        }

        const payload = (await response.json()) as ChatMentionSearchResponse;
        if (requestRef.current !== requestId || controller.signal.aborted) {
          return;
        }

        setUsers(payload.users);
        setActiveIndex(0);
      } catch {
        if (!controller.signal.aborted) {
          setUsers([]);
        }
      }
    }, 120);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [disabled, range]);

  const selectMention = useCallback((user: ChatMentionCandidateSummary) => {
    if (!range) return false;

    const next = insertMentionAtRange(body, range, user.username);
    onBodyChange(next.value);
    closeMentions();

    window.requestAnimationFrame(() => {
      const node = textareaRef.current;
      if (!node) return;
      node.focus();
      node.setSelectionRange(next.caretPosition, next.caretPosition);
      setCaretPosition(next.caretPosition);
    });

    return true;
  }, [body, closeMentions, onBodyChange, range, textareaRef]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!isOpen) {
      return false;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % users.length);
      return true;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + users.length) % users.length);
      return true;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeMentions();
      return true;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      const activeUser = users[activeIndex];
      if (!activeUser) return false;
      event.preventDefault();
      return selectMention(activeUser);
    }

    return false;
  }, [activeIndex, closeMentions, isOpen, selectMention, users]);

  const activeUser = useMemo(
    () => (users.length > 0 ? users[Math.max(0, Math.min(activeIndex, users.length - 1))] : null),
    [activeIndex, users]
  );

  return {
    activeIndex,
    activeUser,
    isOpen,
    selectMention,
    suggestions: users,
    syncCaretPosition,
    closeMentions,
    handleKeyDown,
  };
}
