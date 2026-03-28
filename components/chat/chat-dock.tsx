"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  ExternalLink,
  Flag,
  MoreHorizontal,
  MessagesSquare,
  Volume2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dropdown } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { ChatAvatar } from "@/components/chat/chat-avatar";
import { ChatMessageBody } from "@/components/chat/chat-message-body";
import { ChatOnlineUsersModal } from "@/components/chat/chat-online-users-modal";
import { MentionSuggestions } from "@/components/chat/mention-suggestions";
import { useChatOnlineUsers } from "@/components/chat/use-chat-online-users";
import { useChatMentionAutocomplete } from "@/components/chat/use-chat-mention-autocomplete";
import type { ChatDictionary } from "@/lib/chat-i18n";
import { getChatUiCopy } from "@/lib/chat-i18n";
import type {
  ChatEventEnvelope,
  ChatMessageSummary,
  ChatOverviewResponse,
} from "@/types/chat";

interface ChatDockProps {
  lang: string;
  dict: ChatDictionary;
  currentUserId: string;
  userRole: string;
}

type QuickModerationAction =
  | "delete_message"
  | "restore_message"
  | "timeout_user"
  | "ban_user";

const TIMEOUT_PRESETS = [5, 15, 60, 1440] as const;

const DEFAULT_READ_STATE: ChatOverviewResponse["readState"] = {
  muted: false,
  soundMode: "off",
  browserNotifications: false,
  lastReadVisibleSeq: 0,
};

const DEFAULT_PERMISSIONS: ChatOverviewResponse["permissions"] = {
  canPost: false,
  canPostLinks: false,
  requiresEmailVerification: true,
  moderationReady: false,
  timeoutUntil: null,
  chatStatus: "active",
  trustTier: "new",
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function toneClass(tone: string) {
  switch (tone) {
    case "green":
      return "border border-pa-green/15 bg-pa-green/10 text-pa-green";
    case "gold":
      return "border border-yellow-300/15 bg-yellow-500/10 text-yellow-300";
    case "lilac":
      return "border border-purple-200/15 bg-pa-lila/20 text-purple-200";
    case "blue":
      return "border border-blue-300/15 bg-blue-500/10 text-blue-300";
    default:
      return "border border-white/8 bg-white/5 text-text-secondary";
  }
}

function playNotificationTone(kind: "mention" | "staff") {
  if (typeof window === "undefined") return;
  const AudioContextClass =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error("audio_unsupported");
  }
  const ctx = new AudioContextClass();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = kind === "mention" ? 880 : 660;
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.04, ctx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + 0.2);
}

function isProtectedModerationTarget(message: ChatMessageSummary, currentUserId: string) {
  return (
    message.author?.id === currentUserId ||
    message.author?.role === "admin" ||
    message.author?.role === "super_admin" ||
    message.author?.role === "moderator"
  );
}

function formatTimeoutPreset(minutes: number) {
  if (minutes >= 1440) {
    return `${Math.round(minutes / 60 / 24 * 10) / 10} T`;
  }
  if (minutes >= 60) {
    return minutes % 60 === 0 ? `${minutes / 60} Std` : `${minutes} Min`;
  }
  return `${minutes} Min`;
}

export function ChatDock({ lang, dict, currentUserId, userRole }: ChatDockProps) {
  const pathname = usePathname();
  const copy = getChatUiCopy(lang, dict);
  const { toast } = useToast();
  const isStaff = userRole === "admin" || userRole === "super_admin" || userRole === "moderator";
  const hiddenOnRoute = pathname === `/${lang}/chat` || pathname.startsWith(`/${lang}/admin/chat`);

  const [isDesktop, setIsDesktop] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [room, setRoom] = useState<ChatOverviewResponse["room"] | null>(null);
  const [messages, setMessages] = useState<ChatMessageSummary[]>([]);
  const [readState, setReadState] = useState(DEFAULT_READ_STATE);
  const [permissions, setPermissions] = useState(DEFAULT_PERMISSIONS);
  const [selfUsername, setSelfUsername] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingNewCount, setPendingNewCount] = useState(0);
  const [pendingMentionCount, setPendingMentionCount] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<ChatMessageSummary | null>(null);
  const [reportCategory, setReportCategory] = useState("spam");
  const [reportNote, setReportNote] = useState("");
  const [onlineUsersOpen, setOnlineUsersOpen] = useState(false);
  const [moderationOpen, setModerationOpen] = useState(false);
  const [moderationTarget, setModerationTarget] =
    useState<ChatMessageSummary | null>(null);
  const [moderationAction, setModerationAction] =
    useState<QuickModerationAction | null>(null);
  const [moderationReason, setModerationReason] = useState("");
  const [timeoutPreset, setTimeoutPreset] = useState<string>("15");
  const [customTimeoutMinutes, setCustomTimeoutMinutes] = useState("");
  const [moderating, setModerating] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const shouldStickToBottomRef = useRef(true);
  const pendingScrollToBottomRef = useRef(false);
  const shouldRefocusComposerRef = useRef(false);
  const isComposingRef = useRef(false);

  const isPanelOpen = isDesktop ? desktopOpen : mobileOpen;
  const unreadCount = room ? Math.max(0, room.lastVisibleSeq - readState.lastReadVisibleSeq) : 0;
  const badgeCount = Math.max(unreadCount, pendingNewCount);

  const soundModeOptions = useMemo(
    () => [
      { value: "off", label: copy.sounds.off },
      { value: "all", label: copy.sounds.all },
      { value: "mentions_only", label: copy.sounds.mentionsOnly },
      { value: "mentions_and_staff", label: copy.sounds.mentionsAndStaff },
    ],
    [copy.sounds.all, copy.sounds.off, copy.sounds.mentionsOnly, copy.sounds.mentionsAndStaff]
  );
  const currentSoundModeLabel =
    soundModeOptions.find((option) => option.value === readState.soundMode)?.label ??
    copy.sounds.off;
  const collapseLabel =
    lang === "de" && copy.page.collapse === "Einklappen" ? "Schließen" : copy.page.collapse;
  const currentSoundBadge = (() => {
    switch (readState.soundMode) {
      case "all":
        return {
          label: copy.sounds.badgeAll,
          className: "border-pa-green/15 bg-pa-green/10 text-pa-green",
        };
      case "mentions_only":
        return {
          label: copy.sounds.badgeMentionsOnly,
          className: "border-blue-300/15 bg-blue-500/10 text-blue-300",
        };
      case "mentions_and_staff":
        return {
          label: copy.sounds.badgeMentionsAndStaff,
          className: "border-purple-200/15 bg-pa-lila/20 text-purple-200",
        };
      default:
        return {
          label: copy.sounds.badgeOff,
          className: "border-white/8 bg-white/5 text-text-secondary",
        };
    }
  })();
  const {
    activeIndex: mentionActiveIndex,
    closeMentions,
    handleKeyDown: handleMentionKeyDown,
    selectMention,
    suggestions: mentionSuggestions,
    syncCaretPosition,
  } = useChatMentionAutocomplete({
    body,
    disabled: sending || !permissions.canPost,
    textareaRef: composerRef,
    onBodyChange: setBody,
  });
  const {
    error: onlineUsersError,
    loading: onlineUsersLoading,
    users: onlineUsers,
  } = useChatOnlineUsers(
    onlineUsersOpen,
    room?.onlineCount ?? 0,
    copy.page.onlineUsersLoadError
  );

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1280px)");
    const sync = () => setIsDesktop(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!isPanelOpen) return;
    pendingScrollToBottomRef.current = true;
    setPendingMentionCount(0);
  }, [isPanelOpen]);

  useEffect(() => {
    const node = listRef.current;
    if (!node) return;

    function handleScroll() {
      const currentNode = listRef.current;
      if (!currentNode) return;
      const distance =
        currentNode.scrollHeight - currentNode.scrollTop - currentNode.clientHeight;
      shouldStickToBottomRef.current = distance < 40;
      if (shouldStickToBottomRef.current) {
        setPendingNewCount(0);
      }
    }

    node.addEventListener("scroll", handleScroll);
    return () => node.removeEventListener("scroll", handleScroll);
  }, [isPanelOpen]);

  useEffect(() => {
    if (!isPanelOpen) return;
    if (!pendingScrollToBottomRef.current && !shouldStickToBottomRef.current) return;

    const frame = window.requestAnimationFrame(() => {
      const node = listRef.current;
      if (!node) return;
      node.scrollTop = node.scrollHeight;
      shouldStickToBottomRef.current = true;
      pendingScrollToBottomRef.current = false;
      setPendingNewCount(0);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isPanelOpen, messages]);

  useEffect(() => {
    if (sending || !shouldRefocusComposerRef.current) return;
    shouldRefocusComposerRef.current = false;
    if (!permissions.canPost) return;

    const frame = window.requestAnimationFrame(() => {
      composerRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [permissions.canPost, sending]);

  async function loadOverview() {
    try {
      setLoadError(null);
      const res = await fetch("/api/chat", { cache: "no-store" });
      if (!res.ok) {
        throw new Error("load_failed");
      }
      const payload = (await res.json()) as ChatOverviewResponse;
      setRoom(payload.room);
      setMessages(payload.messages);
      setReadState(payload.readState);
      setPermissions(payload.permissions);
      setSelfUsername(payload.selfUsername);
      setPendingMentionCount(
        payload.messages.filter(
          (message) =>
            (message.visibleSeq ?? 0) > payload.readState.lastReadVisibleSeq &&
            message.author?.id !== currentUserId &&
            message.mentionTargets.some((target) => target.userId === currentUserId)
        ).length
      );
    } catch {
      setLoadError(copy.states.loadError);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOverview();
  }, []);

  useEffect(() => {
    const source = new EventSource("/api/chat/events");

    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as ChatEventEnvelope;
        if (payload.type === "message_created") {
          const nextMessage = (payload.payload as { message: ChatMessageSummary }).message;
          const isSelfMessage = nextMessage.author?.id === currentUserId;
          setMessages((current) => {
            const next = [...current.filter((item) => item.id !== nextMessage.id), nextMessage];
            return next.sort((a, b) => (a.visibleSeq ?? 0) - (b.visibleSeq ?? 0));
          });
          setRoom((current) =>
            current
              ? {
                  ...current,
                  lastVisibleSeq: Math.max(current.lastVisibleSeq, nextMessage.visibleSeq ?? current.lastVisibleSeq),
                }
              : current
          );

          const mentionsCurrentUser = Boolean(
            nextMessage.author?.id !== currentUserId &&
              (
                nextMessage.mentionTargets.some((target) => target.userId === currentUserId) ||
                (selfUsername &&
                  nextMessage.body.toLowerCase().includes(`@${selfUsername.toLowerCase()}`))
              )
          );
          const isStaffMessage =
            nextMessage.author?.role === "admin" ||
            nextMessage.author?.role === "super_admin" ||
            nextMessage.author?.role === "moderator";

          if (readState.soundMode !== "off") {
            if (
              (readState.soundMode === "all" && nextMessage.author?.id !== currentUserId) ||
              mentionsCurrentUser ||
              (readState.soundMode === "mentions_and_staff" && isStaffMessage)
            ) {
              try {
                playNotificationTone(mentionsCurrentUser ? "mention" : "staff");
              } catch {
                toast({ type: "warning", title: copy.states.soundUnavailable });
              }
            }
          }

          if (isSelfMessage || (isPanelOpen && shouldStickToBottomRef.current)) {
            pendingScrollToBottomRef.current = true;
          } else {
            setPendingNewCount((count) => count + 1);
            if (mentionsCurrentUser && !isPanelOpen) {
              setPendingMentionCount((count) => count + 1);
            }
          }
        }

        if (payload.type === "message_removed") {
          const removed = payload.payload as { messageId: string };
          setMessages((current) => current.filter((item) => item.id !== removed.messageId));
        }

        if (payload.type === "room_state") {
          setRoom((payload.payload as { room: ChatOverviewResponse["room"] }).room);
        }

        if (payload.type === "user_notice") {
          const notice = payload.payload as {
            kind?: string;
            reason?: string | null;
            expiresAt?: string | null;
          };
          if (notice.kind === "message_rejected") {
            toast({ type: "warning", title: notice.reason ?? copy.reports.error });
          }
          if (notice.kind === "timeout_user") {
            setPermissions((current) => ({
              ...current,
              chatStatus: "timed_out",
              timeoutUntil: notice.expiresAt ?? current.timeoutUntil,
              canPost: false,
            }));
          }
          if (notice.kind === "ban_user") {
            setPermissions((current) => ({ ...current, chatStatus: "banned", canPost: false }));
          }
          if (notice.kind === "lift_timeout" || notice.kind === "lift_ban") {
            setPermissions((current) => ({
              ...current,
              chatStatus: "active",
              timeoutUntil: null,
              canPost:
                current.moderationReady &&
                room?.mode !== "read_only" &&
                !(room?.mode === "announcement_only" && !isStaff),
            }));
          }
        }
      } catch {
        // ignore malformed event payloads
      }
    };

    return () => source.close();
  }, [
    copy.reports.error,
    copy.states.deleted,
    copy.states.soundUnavailable,
    currentUserId,
    isPanelOpen,
    isStaff,
    readState.soundMode,
    room?.mode,
    selfUsername,
    toast,
  ]);

  useEffect(() => {
    if (!room?.lastVisibleSeq || room.lastVisibleSeq <= readState.lastReadVisibleSeq) return;
    if (!isPanelOpen || !shouldStickToBottomRef.current) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/chat/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lastReadVisibleSeq: room.lastVisibleSeq }),
          signal: controller.signal,
        });
        if (!res.ok) return;
        const payload = (await res.json()) as { readState: ChatOverviewResponse["readState"] };
        setReadState(payload.readState);
      } catch {
        // ignore read sync failures
      }
    }, 400);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [isPanelOpen, readState.lastReadVisibleSeq, room?.lastVisibleSeq]);

  async function submitMessage() {
    if (sending) return;
    const trimmed = body.trim();
    if (!trimmed) return;

    shouldRefocusComposerRef.current = true;
    setSending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: trimmed }),
      });
      const payload = await res.json();

      if (!res.ok) {
        const error = payload.error as string | undefined;
        let message = copy.states.networkError;
        if (error === "links_not_allowed") message = copy.composer.linkAdminOnly;
        if (error === "not_verified") message = copy.composer.verificationRequired;
        if (error === "read_only") message = copy.composer.readOnly;
        if (error === "announcement_only") message = copy.composer.announcementOnly;
        if (error === "timeout_active") message = copy.composer.timeoutActive;
        if (error === "banned") message = copy.composer.banned;
        if (error === "moderation_unavailable") {
          message = copy.composer.moderationUnavailable;
          setPermissions((current) => ({ ...current, canPost: false, moderationReady: false }));
        }
        if (
          error === "rate_limited" ||
          error === "slow_mode_active" ||
          error === "duplicate_message"
        ) {
          message = copy.composer.rateLimited;
        }
        if (error === "message_blocked") message = copy.composer.blocked;
        toast({ type: "error", title: message });
        return;
      }

      if (payload.moderationStatus === "held") {
        toast({ type: "info", title: copy.states.held });
      }

      setBody("");
    } catch {
      toast({ type: "error", title: copy.states.networkError });
    } finally {
      setSending(false);
    }
  }

  async function saveSoundMode(value: string) {
    try {
      const res = await fetch("/api/chat/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ soundMode: value }),
      });
      const payload = await res.json();
      if (!res.ok) {
        toast({ type: "error", title: copy.states.networkError });
        return;
      }
      setReadState(payload.readState);
      toast({ type: "success", title: copy.sounds.saved });
    } catch {
      toast({ type: "error", title: copy.states.networkError });
    }
  }

  async function submitReport() {
    if (!reportTarget) return;
    try {
      const res = await fetch("/api/chat/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: reportTarget.id,
          category: reportCategory,
          note: reportNote.trim() || undefined,
        }),
      });
      if (!res.ok) {
        toast({ type: "error", title: copy.reports.error });
        return;
      }
      toast({ type: "success", title: copy.reports.success });
      setReportOpen(false);
      setReportTarget(null);
      setReportCategory("spam");
      setReportNote("");
    } catch {
      toast({ type: "error", title: copy.reports.error });
    }
  }

  function getModerationLabel(action: QuickModerationAction): string {
    switch (action) {
      case "delete_message":
        return copy.admin.delete;
      case "restore_message":
        return copy.admin.restore;
      case "timeout_user":
        return `${copy.admin.timeout} · ${formatTimeoutPreset(getSelectedTimeoutMinutes())}`;
      case "ban_user":
        return copy.admin.ban;
    }
  }

  function getSelectedTimeoutMinutes() {
    if (timeoutPreset === "custom") {
      const parsed = Number.parseInt(customTimeoutMinutes, 10);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    return Number.parseInt(timeoutPreset, 10);
  }

  function openModerationAction(
    action: QuickModerationAction,
    message: ChatMessageSummary
  ) {
    setModerationAction(action);
    setModerationTarget(message);
    setModerationReason("");
    setTimeoutPreset("15");
    setCustomTimeoutMinutes("");
    setModerationOpen(true);
  }

  async function submitModerationAction() {
    if (!moderationAction || !moderationTarget || moderating) {
      return;
    }

    const payload: Record<string, unknown> = {
      action: moderationAction,
      reason: moderationReason.trim() || undefined,
    };

    if (moderationAction === "delete_message" || moderationAction === "restore_message") {
      payload.messageId = moderationTarget.id;
    }

    if (moderationAction === "timeout_user" || moderationAction === "ban_user") {
      if (!moderationTarget.author?.id) {
        toast({ type: "error", title: copy.states.networkError });
        return;
      }

      payload.targetUserId = moderationTarget.author.id;
      payload.sourceMessageId = moderationTarget.id;
      if (moderationAction === "timeout_user") {
        const minutes = getSelectedTimeoutMinutes();
        if (!Number.isInteger(minutes) || minutes < 1 || minutes > 60 * 24 * 30) {
          toast({ type: "error", title: copy.admin.invalidDuration });
          return;
        }
        payload.durationMinutes = minutes;
      }
    }

    setModerating(true);
    try {
      const res = await fetch("/api/admin/chat/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        toast({ type: "error", title: copy.states.networkError });
        return;
      }

      toast({ type: "success", title: getModerationLabel(moderationAction) });
      setModerationOpen(false);
      setModerationTarget(null);
      setModerationAction(null);
      setModerationReason("");
      setTimeoutPreset("15");
      setCustomTimeoutMinutes("");
    } catch {
      toast({ type: "error", title: copy.states.networkError });
    } finally {
      setModerating(false);
    }
  }

  const cannotPostMessage =
    permissions.chatStatus === "banned"
      ? copy.composer.banned
      : permissions.chatStatus === "timed_out"
        ? copy.composer.timeoutActive
        : !permissions.moderationReady && !isStaff
          ? copy.composer.moderationUnavailable
          : room?.mode === "read_only"
            ? copy.composer.readOnly
            : room?.mode === "announcement_only" && !isStaff
              ? copy.composer.announcementOnly
              : !permissions.canPost && !permissions.canPostLinks
                ? copy.composer.verificationRequired
                : null;

  function openPanel() {
    if (isDesktop) {
      setDesktopOpen(true);
    } else {
      setMobileOpen(true);
    }
  }

  function closePanel() {
    if (isDesktop) {
      setDesktopOpen(false);
    } else {
      setMobileOpen(false);
    }
  }

  if (hiddenOnRoute) {
    return null;
  }

  const panelContent = (
    <div className="flex h-full flex-col overflow-hidden rounded-[24px] border border-white/10 bg-surface-elevated/95 ring-1 ring-white/6 backdrop-blur-xl">
      <div className="border-b border-white/8 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold leading-tight text-text-primary">
                {copy.page.roomTitle}
              </h3>
              {room && room.mode !== "open" ? (
                <span className="rounded-full border border-pa-green/15 bg-pa-green/10 px-2 py-0.5 text-[10px] font-semibold text-pa-green">
                  {copy.roomModes[room.mode]}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isStaff ? (
              <Link
                href={`/${lang}/admin/chat`}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/8 bg-white/4 text-text-secondary transition-colors hover:text-pa-green"
                title="Moderation"
              >
                <ExternalLink className="h-4 w-4" />
              </Link>
            ) : null}
            {isDesktop ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={closePanel}
                className="h-9 shrink-0 whitespace-nowrap px-3 text-xs font-semibold"
                aria-label={collapseLabel}
              >
                <ChevronRight className="h-4 w-4" />
                {collapseLabel}
              </Button>
            ) : (
              <button
                type="button"
                onClick={closePanel}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/8 bg-white/4 text-text-secondary transition-colors hover:text-pa-green"
                aria-label={collapseLabel}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Dropdown
            align="left"
            minWidth={220}
            selectedValue={readState.soundMode}
            trigger={
              <button
                type="button"
                className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-white/8 bg-white/4 px-3 text-xs font-medium text-text-secondary transition-colors hover:text-pa-green"
                aria-label={copy.sounds.label}
                title={`${copy.sounds.label}: ${currentSoundModeLabel}`}
              >
                <Volume2 className="h-3.5 w-3.5" />
                <span>{copy.sounds.label}</span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${currentSoundBadge.className}`}
                >
                  {currentSoundBadge.label}
                </span>
              </button>
            }
            items={soundModeOptions.map((option) => ({
              label: option.label,
              value: option.value,
              onClick: (value) => {
                void saveSoundMode(value);
              },
            }))}
          />
          <button
            type="button"
            onClick={() => setOnlineUsersOpen(true)}
            className="inline-flex min-w-0 items-center gap-2 rounded-full border border-white/8 bg-white/4 px-3 py-1 text-xs font-medium text-text-secondary transition-colors hover:text-pa-green"
            title={copy.page.onlineUsersTitle}
          >
            <span className="inline-block h-2 w-2 rounded-full bg-pa-green" />
            <span>
              {room?.onlineCount ?? 0} {copy.page.online}
            </span>
          </button>
        </div>
      </div>

      <div ref={listRef} className="relative flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {loading ? (
          <p className="text-sm text-text-muted">{copy.page.loading}</p>
        ) : loadError ? (
          <div className="rounded-[14px] border border-red-500/15 bg-red-500/10 p-3 text-sm text-red-200">
            {loadError}
          </div>
        ) : messages.length === 0 ? (
          <p className="text-sm text-text-muted">{copy.page.empty}</p>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="rounded-[16px] border border-white/7 bg-black/12 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <ChatAvatar
                    name={message.author?.username ?? message.author?.name ?? "System"}
                    src={message.author?.avatarUrl ?? null}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-text-primary">
                        {message.author?.username ?? message.author?.name ?? "System"}
                      </span>
                      {message.author?.roleBadge ? (
                        <span className="rounded-full border border-pa-green/15 bg-pa-green/10 px-2 py-0.5 text-[10px] font-semibold text-pa-green">
                          {message.author.roleBadge}
                        </span>
                      ) : null}
                    </div>
                    {message.author?.profileBadges.length ? (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {message.author.profileBadges.map((badge) => (
                          <span
                            key={badge.key}
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${toneClass(badge.tone)}`}
                          >
                            {badge.label}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-text-muted">
                  <time title={new Date(message.createdAt).toLocaleString("de-DE")}>
                    {formatTime(message.createdAt)}
                  </time>
                  {isStaff ? (
                    <Dropdown
                      align="right"
                      side="auto"
                      minWidth={180}
                      trigger={
                        <button
                          type="button"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/8 bg-white/4 text-text-muted transition-colors hover:text-pa-green"
                          aria-label={copy.admin.quickActions}
                          title={copy.admin.quickActions}
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>
                      }
                      items={[
                        ...(message.isDeleted
                          ? [
                              {
                                label: copy.admin.restore,
                                value: `restore:${message.id}`,
                                onClick: () => openModerationAction("restore_message", message),
                              },
                            ]
                          : [
                              {
                                label: copy.admin.delete,
                                value: `delete:${message.id}`,
                                onClick: () => openModerationAction("delete_message", message),
                              },
                            ]),
                        ...(message.author?.id &&
                        !isProtectedModerationTarget(message, currentUserId) &&
                        !message.isDeleted
                          ? [
                              {
                                label: copy.admin.timeout,
                                value: `timeout:${message.id}`,
                                onClick: () => openModerationAction("timeout_user", message),
                              },
                              {
                                label: copy.admin.ban,
                                value: `ban:${message.id}`,
                                onClick: () => openModerationAction("ban_user", message),
                              },
                            ]
                          : []),
                      ]}
                    />
                  ) : !message.isDeleted && message.author?.id !== currentUserId ? (
                    <button
                      type="button"
                      onClick={() => {
                        setReportTarget(message);
                        setReportOpen(true);
                      }}
                      className="inline-flex items-center text-text-muted transition-colors hover:text-pa-green"
                    >
                      <Flag className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>
              <ChatMessageBody
                body={message.body}
                className={`mt-2 whitespace-pre-wrap break-words text-sm ${message.isDeleted ? "italic text-text-muted" : "text-text-primary"}`}
              />
            </div>
          ))
        )}

        {pendingNewCount > 0 && isPanelOpen ? (
          <div className="sticky bottom-2 flex justify-center">
            <button
              type="button"
              onClick={() => {
                const node = listRef.current;
                if (node) {
                  node.scrollTop = node.scrollHeight;
                }
                shouldStickToBottomRef.current = true;
                setPendingNewCount(0);
              }}
              className="rounded-full border border-pa-green/15 bg-pa-green/10 px-3 py-1 text-xs font-semibold text-pa-green"
            >
              {copy.page.newMessages} ({pendingNewCount})
            </button>
          </div>
        ) : null}
      </div>

      <div className="border-t border-white/8 px-4 py-4">
        {cannotPostMessage ? (
          <div className="mb-3 rounded-[12px] border border-yellow-500/15 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-200">
            {cannotPostMessage}
          </div>
        ) : null}

        <div className="flex gap-3">
          <div className="relative flex-1">
            <MentionSuggestions
              users={mentionSuggestions}
              activeIndex={mentionActiveIndex}
              onSelect={selectMention}
            />
            <textarea
              ref={composerRef}
              value={body}
              onChange={(event) => {
                setBody(event.target.value);
                syncCaretPosition(event.target.selectionStart);
              }}
              onClick={(event) => syncCaretPosition(event.currentTarget.selectionStart)}
              onKeyUp={(event) => syncCaretPosition(event.currentTarget.selectionStart)}
              onBlur={() => {
                window.setTimeout(() => closeMentions(), 0);
              }}
              onCompositionStart={() => {
                isComposingRef.current = true;
              }}
              onCompositionEnd={(event) => {
                isComposingRef.current = false;
                syncCaretPosition(event.currentTarget.selectionStart);
              }}
              onKeyDown={(event) => {
                if (handleMentionKeyDown(event)) {
                  return;
                }
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !isComposingRef.current
                ) {
                  event.preventDefault();
                  void submitMessage();
                }
              }}
              placeholder={copy.composer.placeholder}
              rows={3}
              maxLength={500}
              disabled={sending || !permissions.canPost}
              className="min-h-[92px] w-full rounded-[14px] border border-white/8 bg-white/4 px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-pa-green/35 focus:ring-2 focus:ring-pa-green/6 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
          <Button
            onClick={submitMessage}
            loading={sending}
            disabled={!permissions.canPost || !body.trim()}
            className="self-center"
          >
            {sending ? copy.composer.sending : copy.composer.send}
          </Button>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-text-muted">
          <span>
            {room?.mode === "slow_mode" && room.slowModeSeconds > 0
              ? `${copy.composer.slowMode}: ${room.slowModeSeconds}s`
              : copy.composer.shortcutHint}
          </span>
          <span>{body.trim().length} / 500</span>
        </div>
      </div>
    </div>
  );

  const triggerBadgeCount = pendingMentionCount > 0 ? pendingMentionCount : badgeCount;
  const triggerBadgeClassName =
    pendingMentionCount > 0 ? "bg-red-500 text-white" : "bg-pa-green text-bg";

  return (
    <>
      <div className="hidden xl:block">
        {desktopOpen ? (
          <div className="fixed bottom-4 right-4 top-20 z-30 w-[420px]">{panelContent}</div>
        ) : (
          <div className="fixed bottom-24 right-4 z-30">
            <button
              type="button"
              onClick={openPanel}
              className="group flex items-center gap-3 rounded-full border border-white/10 bg-surface-elevated/95 px-4 py-3 ring-1 ring-white/6 transition-colors hover:border-pa-green/25"
              title={copy.page.expand}
            >
              <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-pa-green/10 text-pa-green">
                <MessagesSquare className="h-5 w-5" />
                {triggerBadgeCount > 0 ? (
                  <span className={`absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${triggerBadgeClassName}`}>
                    {triggerBadgeCount > 99 ? "99+" : triggerBadgeCount}
                  </span>
                ) : null}
              </span>
              <div className="text-left">
                <p className="text-sm font-semibold text-text-primary">{copy.page.roomTitle}</p>
                <p className="text-xs text-text-secondary">{room?.onlineCount ?? 0} {copy.page.online}</p>
              </div>
            </button>
          </div>
        )}
      </div>

      <div className="xl:hidden">
        {!mobileOpen ? (
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="fixed bottom-24 right-4 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-surface-elevated/95 text-pa-green ring-1 ring-white/6"
            title={copy.page.expand}
          >
            <MessagesSquare className="h-5 w-5" />
            {triggerBadgeCount > 0 ? (
              <span className={`absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${triggerBadgeClassName}`}>
                {triggerBadgeCount > 99 ? "99+" : triggerBadgeCount}
              </span>
            ) : null}
          </button>
        ) : (
          <>
            <div className="fixed inset-0 z-30 bg-black/60" onClick={() => setMobileOpen(false)} />
            <div className="fixed inset-x-3 bottom-3 top-24 z-[35]">{panelContent}</div>
          </>
        )}
      </div>

      <Modal open={reportOpen} onClose={() => setReportOpen(false)} title={copy.reports.title}>
        <p className="text-sm text-text-secondary">{copy.reports.description}</p>
        <div className="mt-4 space-y-3">
          <Select
            options={[
              { value: "spam", label: copy.reports.spam },
              { value: "scam", label: copy.reports.scam },
              { value: "hate", label: copy.reports.hate },
              { value: "harassment", label: copy.reports.harassment },
              { value: "sexual", label: copy.reports.sexual },
              { value: "pii", label: copy.reports.pii },
              { value: "other", label: copy.reports.other },
            ]}
            value={reportCategory}
            onChange={setReportCategory}
            className="w-full"
          />
          <textarea
            value={reportNote}
            onChange={(event) => setReportNote(event.target.value)}
            rows={4}
            className="w-full rounded-[12px] border border-white/8 bg-white/3 px-4 py-3 text-sm text-text-primary outline-none focus:border-pa-green/35 focus:ring-2 focus:ring-pa-green/6"
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setReportOpen(false)}>
              {copy.reports.cancel}
            </Button>
            <Button onClick={submitReport}>{copy.reports.submit}</Button>
          </div>
        </div>
      </Modal>

      <ChatOnlineUsersModal
        open={onlineUsersOpen}
        onClose={() => setOnlineUsersOpen(false)}
        copy={copy}
        users={onlineUsers}
        loading={onlineUsersLoading}
        error={onlineUsersError}
      />

      <Modal
        open={moderationOpen}
        onClose={() => {
          setModerationOpen(false);
          setModerationTarget(null);
          setModerationAction(null);
          setModerationReason("");
          setTimeoutPreset("15");
          setCustomTimeoutMinutes("");
        }}
        title={
          moderationAction
            ? `${copy.admin.quickActions}: ${getModerationLabel(moderationAction)}`
            : copy.admin.quickActions
        }
      >
        <div className="space-y-4">
          {moderationTarget ? (
            <div className="rounded-[12px] border border-white/8 bg-white/4 px-4 py-3 text-sm text-text-secondary">
              <p className="font-medium text-text-primary">
                {moderationTarget.author?.name ?? "System"}
              </p>
              <p className="mt-2 whitespace-pre-wrap break-words">
                {moderationTarget.body}
              </p>
            </div>
          ) : null}
          {moderationAction === "timeout_user" ? (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                {copy.admin.timeoutDuration}
              </p>
              <div className="flex flex-wrap gap-2">
                {TIMEOUT_PRESETS.map((minutes) => {
                  const active = timeoutPreset === String(minutes);
                  return (
                    <button
                      key={minutes}
                      type="button"
                      onClick={() => setTimeoutPreset(String(minutes))}
                      className={[
                        "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                        active
                          ? "border-pa-green/20 bg-pa-green/12 text-pa-green"
                          : "border-white/8 bg-white/4 text-text-secondary hover:text-text-primary",
                      ].join(" ")}
                    >
                      {formatTimeoutPreset(minutes)}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setTimeoutPreset("custom")}
                  className={[
                    "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                    timeoutPreset === "custom"
                      ? "border-pa-green/20 bg-pa-green/12 text-pa-green"
                      : "border-white/8 bg-white/4 text-text-secondary hover:text-text-primary",
                  ].join(" ")}
                >
                  {copy.admin.timeoutManual}
                </button>
              </div>
              {timeoutPreset === "custom" ? (
                <Input
                  label={copy.admin.minutes}
                  value={customTimeoutMinutes}
                  onChange={(event) => setCustomTimeoutMinutes(event.target.value)}
                  inputMode="numeric"
                />
              ) : null}
            </div>
          ) : null}
          <Input
            label={copy.admin.reason}
            value={moderationReason}
            maxLength={300}
            onChange={(event) => setModerationReason(event.target.value)}
          />
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setModerationOpen(false);
                setModerationTarget(null);
                setModerationAction(null);
                setModerationReason("");
                setTimeoutPreset("15");
                setCustomTimeoutMinutes("");
              }}
            >
              {copy.reports.cancel}
            </Button>
            <Button onClick={submitModerationAction} loading={moderating}>
              {moderationAction ? getModerationLabel(moderationAction) : copy.admin.apply}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
