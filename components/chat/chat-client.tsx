"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Flag, ImageIcon, ShieldAlert, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChatBadgeDetailModal } from "@/components/chat/chat-badge-detail-modal";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { ChatAvatar } from "@/components/chat/chat-avatar";
import { ChatGifAttachmentPreview } from "@/components/chat/chat-gif-attachment-preview";
import { ChatGifPicker } from "@/components/chat/chat-gif-picker";
import { ChatMessageContent } from "@/components/chat/chat-message-content";
import { ChatMessageReactions } from "@/components/chat/chat-message-reactions";
import { ChatUserCard } from "@/components/chat/chat-user-card";
import { ChatUserBadges } from "@/components/chat/chat-user-badges";
import { ChatOnlineUsersModal } from "@/components/chat/chat-online-users-modal";
import { MentionSuggestions } from "@/components/chat/mention-suggestions";
import { useChatOnlineUsers } from "@/components/chat/use-chat-online-users";
import { useChatMentionAutocomplete } from "@/components/chat/use-chat-mention-autocomplete";
import { messageMentionsViewer } from "@/lib/chat-mentions";
import { mergeChatMessageSummaries } from "@/lib/chat-message-summary";
import type { ChatDictionary } from "@/lib/chat-i18n";
import { getChatUiCopy } from "@/lib/chat-i18n";
import type {
  ChatEventEnvelope,
  ChatAuthorSummary,
  ChatBadgeSummary,
  ChatGifSummary,
  ChatMessageSummary,
  ChatOnlineUserSummary,
  ChatOverviewResponse,
} from "@/types/chat";

interface ChatClientProps {
  lang: string;
  dict: ChatDictionary;
  initialData: ChatOverviewResponse;
  currentUserId: string;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
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

export function ChatClient({ lang, dict, initialData, currentUserId }: ChatClientProps) {
  const copy = getChatUiCopy(lang, dict);
  const { toast } = useToast();
  const [messages, setMessages] = useState(initialData.messages);
  const [room, setRoom] = useState(initialData.room);
  const [readState, setReadState] = useState(initialData.readState);
  const [permissions, setPermissions] = useState(initialData.permissions);
  const [body, setBody] = useState("");
  const [attachedGif, setAttachedGif] = useState<ChatGifSummary | null>(null);
  const [sending, setSending] = useState(false);
  const [pendingNewCount, setPendingNewCount] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportCategory, setReportCategory] = useState("spam");
  const [reportNote, setReportNote] = useState("");
  const [reportTarget, setReportTarget] = useState<ChatMessageSummary | null>(null);
  const [onlineUsersOpen, setOnlineUsersOpen] = useState(false);
  const [gifPickerOpen, setGifPickerOpen] = useState(false);
  const [pendingReactionMessageIds, setPendingReactionMessageIds] = useState<string[]>([]);
  const [activeUserCard, setActiveUserCard] = useState<{
    user: ChatAuthorSummary | ChatOnlineUserSummary;
    rect: DOMRect;
  } | null>(null);
  const [activeBadge, setActiveBadge] = useState<ChatBadgeSummary | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const gifButtonRef = useRef<HTMLButtonElement>(null);
  const shouldStickToBottomRef = useRef(true);
  const shouldRefocusComposerRef = useRef(false);
  const isComposingRef = useRef(false);

  const soundModeOptions = useMemo(
    () => [
      { value: "off", label: copy.sounds.off },
      { value: "all", label: copy.sounds.all },
      { value: "mentions_only", label: copy.sounds.mentionsOnly },
      { value: "mentions_and_staff", label: copy.sounds.mentionsAndStaff },
    ],
    [copy.sounds.all, copy.sounds.mentionsAndStaff, copy.sounds.mentionsOnly, copy.sounds.off]
  );
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
  } = useChatOnlineUsers(onlineUsersOpen, room.onlineCount, copy.page.onlineUsersLoadError);
  const isMentionForCurrentUser = useCallback((message: ChatMessageSummary) => {
    return messageMentionsViewer(
      {
        authorUserId: message.author?.id ?? null,
        body: message.body,
        mentionTargets: message.mentionTargets,
      },
      currentUserId,
      initialData.selfUsername
    );
  }, [currentUserId, initialData.selfUsername]);

  function openUserCard(
    user: ChatAuthorSummary | ChatOnlineUserSummary | null | undefined,
    target: HTMLElement
  ) {
    if (!user) return;
    setActiveUserCard({
      user,
      rect: target.getBoundingClientRect(),
    });
  }

  useEffect(() => {
    const node = listRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, []);

  useEffect(() => {
    if (sending || !shouldRefocusComposerRef.current) return;
    shouldRefocusComposerRef.current = false;
    if (!permissions.canPost) return;

    const frame = window.requestAnimationFrame(() => {
      composerRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [permissions.canPost, sending]);

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
  }, []);

  useEffect(() => {
    const source = new EventSource("/api/chat/events");

    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as ChatEventEnvelope;
        if (payload.type === "message_created") {
          const nextMessage = (payload.payload as { message: ChatMessageSummary }).message;
          setMessages((current) => mergeChatMessageSummaries(current, nextMessage));
          setRoom((current) => ({
            ...current,
            lastVisibleSeq: Math.max(
              current.lastVisibleSeq,
              nextMessage.visibleSeq ?? current.lastVisibleSeq
            ),
          }));

          const mentionsCurrentUser = isMentionForCurrentUser(nextMessage);
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

          if (shouldStickToBottomRef.current) {
            queueMicrotask(() => {
              const currentNode = listRef.current;
              if (currentNode) {
                currentNode.scrollTop = currentNode.scrollHeight;
              }
            });
          } else {
            setPendingNewCount((count) => count + 1);
          }
        }

        if (payload.type === "message_updated") {
          const nextMessage = (payload.payload as { message: ChatMessageSummary }).message;
          setMessages((current) => mergeChatMessageSummaries(current, nextMessage));
        }

        if (payload.type === "message_removed") {
          const removed = payload.payload as { messageId: string };
          setMessages((current) => current.filter((item) => item.id !== removed.messageId));
        }

        if (payload.type === "room_state") {
          setRoom((payload.payload as { room: ChatOverviewResponse["room"] }).room);
        }

        if (payload.type === "user_notice") {
          const notice = payload.payload as { kind?: string; reason?: string | null };
          if (notice.kind === "message_rejected") {
            toast({ type: "warning", title: notice.reason ?? copy.reports.error });
          }
          if (notice.kind === "timeout_user") {
            setPermissions((current) => ({ ...current, chatStatus: "timed_out", canPost: false }));
          }
          if (notice.kind === "ban_user") {
            setPermissions((current) => ({ ...current, chatStatus: "banned", canPost: false }));
          }
        }
      } catch {
        // ignore malformed event payloads
      }
    };

    return () => source.close();
  }, [copy.reports.error, copy.states.deleted, copy.states.soundUnavailable, currentUserId, initialData.selfUsername, isMentionForCurrentUser, readState.soundMode, toast]);

  useEffect(() => {
    if (!room.lastVisibleSeq || room.lastVisibleSeq <= readState.lastReadVisibleSeq) return;
    if (!shouldStickToBottomRef.current) return;

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
  }, [readState.lastReadVisibleSeq, room.lastVisibleSeq]);

  async function submitMessage() {
    if (sending) return;
    const trimmed = body.trim();
    if (!trimmed && !attachedGif) return;

    shouldRefocusComposerRef.current = true;
    setSending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: trimmed,
          gif: attachedGif ?? undefined,
        }),
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
        if (error === "moderation_unavailable") message = copy.composer.moderationUnavailable;
        if (error === "gifs_unavailable" || error === "invalid_gif") {
          message = copy.composer.gifsUnavailable;
          setPermissions((current) => ({ ...current, canUseGifs: false }));
          setAttachedGif(null);
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
      setAttachedGif(null);
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
      setReportNote("");
      setReportTarget(null);
      setReportCategory("spam");
    } catch {
      toast({ type: "error", title: copy.reports.error });
    }
  }

  async function toggleReaction(
    messageId: string,
    emoji: ChatMessageSummary["reactions"][number]["emoji"]
  ) {
    if (pendingReactionMessageIds.includes(messageId)) return;

    setPendingReactionMessageIds((current) => [...current, messageId]);
    try {
      const res = await fetch(`/api/chat/${messageId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      const payload = await res.json();
      if (!res.ok) {
        toast({ type: "error", title: copy.reactions.updateError });
        return;
      }

      const nextMessage = payload.message as ChatMessageSummary;
      setMessages((current) => mergeChatMessageSummaries(current, nextMessage));
    } catch {
      toast({ type: "error", title: copy.reactions.updateError });
    } finally {
      setPendingReactionMessageIds((current) =>
        current.filter((currentMessageId) => currentMessageId !== messageId)
      );
    }
  }

  function scrollToBottom() {
    const node = listRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
    shouldStickToBottomRef.current = true;
    setPendingNewCount(0);
  }

  const cannotPostMessage =
    permissions.chatStatus === "banned"
      ? copy.composer.banned
      : permissions.chatStatus === "timed_out"
        ? copy.composer.timeoutActive
        : !permissions.moderationReady && permissions.chatStatus === "active" && !permissions.canPostLinks
          ? copy.composer.moderationUnavailable
          : !permissions.canPost && !permissions.canPostLinks
            ? copy.composer.verificationRequired
          : room.mode === "read_only"
            ? copy.composer.readOnly
            : room.mode === "announcement_only"
              ? copy.composer.announcementOnly
              : null;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card variant="soft" className="flex min-h-[70vh] flex-col overflow-hidden">
        <div className="border-b border-border px-4 py-4 md:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-text-primary">{copy.page.roomTitle}</h2>
              <p className="mt-1 text-sm text-text-secondary">{copy.page.roomSubtitle}</p>
            </div>
            <button
              type="button"
              onClick={() => setOnlineUsersOpen(true)}
              className="flex items-center gap-2 rounded-full border border-white/8 bg-white/4 px-3 py-1 text-xs font-medium text-text-secondary transition-colors hover:text-pa-green"
              title={copy.page.onlineUsersTitle}
            >
              <span className="inline-block h-2 w-2 rounded-full bg-pa-green" />
              {room.onlineCount} {copy.page.online}
            </button>
          </div>
        </div>

        <div ref={listRef} className="relative flex-1 space-y-3 overflow-y-auto px-4 py-4 md:px-5">
          {messages.length === 0 ? (
            <p className="text-sm text-text-muted">{copy.page.empty}</p>
          ) : (
            messages.map((message) => {
              const mentionedCurrentUser = isMentionForCurrentUser(message);

              return (
                <div
                  key={message.id}
                  className={`rounded-[14px] border p-3 ${
                    mentionedCurrentUser && !message.isDeleted
                      ? "border-pa-green/20 bg-pa-green/8 ring-1 ring-pa-green/10"
                      : "border-white/6 bg-white/3"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      {message.author ? (
                        <>
                          <button
                            type="button"
                            onClick={(event) => openUserCard(message.author, event.currentTarget)}
                            className="flex min-w-0 items-center gap-3 rounded-[12px] text-left outline-none transition-colors hover:text-pa-green focus-visible:text-pa-green"
                          >
                            <ChatAvatar
                              name={message.author.username ?? message.author.name ?? "System"}
                              src={message.author.avatarUrl ?? null}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold text-text-primary">
                                  {message.author.username ?? message.author.name ?? "System"}
                                </span>
                                {message.author.roleBadge && (
                                  <span className="rounded-full border border-pa-green/15 bg-pa-green/10 px-2 py-0.5 text-[10px] font-semibold text-pa-green">
                                    {message.author.roleBadge}
                                  </span>
                                )}
                                {message.author.identityVerified && (
                                  <span className="rounded-full border border-pa-green/15 bg-pa-green/10 px-2 py-0.5 text-[10px] font-semibold text-pa-green">
                                    {copy.badges.verified}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                          {message.author.profileBadges.length ? (
                            <ChatUserBadges badges={message.author.profileBadges} lang={lang} />
                          ) : null}
                        </>
                      ) : (
                        <div className="min-w-0">
                          <span className="text-sm font-semibold text-text-primary">System</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                      <time title={new Date(message.createdAt).toLocaleString("de-DE")}>
                        {formatTime(message.createdAt)}
                      </time>
                      {!message.isDeleted && message.author?.id !== currentUserId && (
                        <button
                          type="button"
                          onClick={() => {
                            setReportTarget(message);
                            setReportOpen(true);
                          }}
                          className="inline-flex items-center gap-1 text-text-muted transition-colors hover:text-pa-green"
                        >
                          <Flag className="h-3.5 w-3.5" />
                          <span className="sr-only">{copy.reports.title}</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <ChatMessageContent
                    body={message.body}
                    gif={message.gif}
                    highlightedMentionUsername={mentionedCurrentUser ? initialData.selfUsername : null}
                    className="mt-2 space-y-2"
                    gifClassName="max-w-[320px]"
                    gifImageClassName="max-h-[320px]"
                    bodyClassName={`whitespace-pre-wrap break-words text-sm ${message.isDeleted ? "italic text-text-muted" : "text-text-primary"}`}
                  />
                  {!message.isDeleted ? (
                    <ChatMessageReactions
                      lang={lang}
                      reactions={message.reactions}
                      currentUserId={currentUserId}
                      disabled={pendingReactionMessageIds.includes(message.id)}
                      onToggle={
                        permissions.canPost
                          ? (emoji) => {
                              void toggleReaction(message.id, emoji);
                            }
                          : undefined
                      }
                      labels={copy.reactions}
                    />
                  ) : null}
                </div>
              );
            })
          )}

          {pendingNewCount > 0 && (
            <div className="sticky bottom-3 flex justify-center">
              <button
                type="button"
                onClick={scrollToBottom}
                className="rounded-full border border-pa-green/15 bg-pa-green/10 px-3 py-1.5 text-xs font-semibold text-pa-green shadow-lg"
              >
                {copy.page.newMessages} ({pendingNewCount})
              </button>
            </div>
          )}
        </div>

        <div className="border-t border-border px-4 py-4 md:px-5">
          {cannotPostMessage && (
            <div className="mb-3 rounded-[10px] border border-yellow-500/15 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-200">
              {cannotPostMessage}
            </div>
          )}
          {attachedGif ? (
            <ChatGifAttachmentPreview
              gif={attachedGif}
              copy={copy}
              onRemove={() => setAttachedGif(null)}
            />
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
                className="min-h-[96px] w-full rounded-[12px] border border-white/8 bg-white/3 px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-pa-green/35 focus:ring-2 focus:ring-pa-green/6 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
            <Button
              onClick={submitMessage}
              loading={sending}
              disabled={!permissions.canPost || (!body.trim() && !attachedGif)}
              className="self-center"
            >
              {sending ? copy.composer.sending : copy.composer.send}
            </Button>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-text-muted">
            <div className="flex items-center gap-2">
              {permissions.canUseGifs ? (
                <button
                  ref={gifButtonRef}
                  type="button"
                  onClick={() => setGifPickerOpen(true)}
                  disabled={sending || !permissions.canPost}
                  className="inline-flex items-center gap-1 rounded-full border border-white/8 bg-white/4 px-2.5 py-1 text-xs font-medium text-text-secondary transition-colors hover:text-pa-green disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ImageIcon className="h-3.5 w-3.5" />
                  {copy.gifs.button}
                </button>
              ) : null}
              <span>
                {room.mode === "slow_mode" && room.slowModeSeconds > 0
                  ? `${copy.composer.slowMode}: ${room.slowModeSeconds}s`
                  : copy.composer.shortcutHint}
              </span>
            </div>
            <span>{body.trim().length} / 500</span>
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        <Card variant="topline" className="p-4">
          <div className="flex items-center gap-2 text-text-primary">
            <ShieldAlert className="h-4 w-4 text-pa-green" />
            <h3 className="text-sm font-semibold uppercase tracking-wider">{copy.page.rulesTitle}</h3>
          </div>
          <p className="mt-3 text-sm text-text-secondary">{copy.page.rulesBody}</p>
          <p className="mt-3 text-xs text-text-muted">{copy.page.archiveNote}</p>
        </Card>

        <Card variant="accent" className="p-4">
          <div className="flex items-center gap-2 text-text-primary">
            <Volume2 className="h-4 w-4 text-pa-green" />
            <h3 className="text-sm font-semibold uppercase tracking-wider">{copy.sounds.label}</h3>
          </div>
          <div className="mt-3">
            <Select
              options={soundModeOptions}
              value={readState.soundMode}
              onChange={saveSoundMode}
              className="w-full"
            />
          </div>
        </Card>
      </div>

      <ChatOnlineUsersModal
        open={onlineUsersOpen}
        onClose={() => setOnlineUsersOpen(false)}
        copy={copy}
        lang={lang}
        users={onlineUsers}
        loading={onlineUsersLoading}
        error={onlineUsersError}
      />

      <ChatGifPicker
        open={gifPickerOpen}
        onClose={() => setGifPickerOpen(false)}
        onAttach={(gif) => {
          setAttachedGif(gif);
          window.requestAnimationFrame(() => {
            composerRef.current?.focus();
          });
        }}
        copy={copy}
        anchorRef={gifButtonRef}
      />

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
            <Button variant="secondary" onClick={() => setReportOpen(false)}>{copy.reports.cancel}</Button>
            <Button onClick={submitReport}>{copy.reports.submit}</Button>
          </div>
        </div>
      </Modal>

      <ChatUserCard
        open={activeUserCard !== null}
        user={activeUserCard?.user ?? null}
        anchorRect={activeUserCard?.rect ?? null}
        lang={lang}
        labels={{
          listTitle: copy.badges.listTitle,
          noBadges: copy.badges.noBadges,
          verified: copy.badges.verified,
        }}
        onClose={() => setActiveUserCard(null)}
        onBadgeClick={(badge) => {
          setActiveUserCard(null);
          setActiveBadge(badge);
        }}
      />

      <ChatBadgeDetailModal
        open={activeBadge !== null}
        badge={activeBadge}
        lang={lang}
        labels={{
          awardedAt: copy.badges.awardedAt,
          reason: copy.badges.reason,
        }}
        onClose={() => setActiveBadge(null)}
      />
    </div>
  );
}





