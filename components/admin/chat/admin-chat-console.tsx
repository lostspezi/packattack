"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Ban,
  Clock3,
  EyeOff,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import type { ChatDictionary } from "@/lib/chat-i18n";
import { getChatUiCopy } from "@/lib/chat-i18n";
import type {
  ChatActionLogResponse,
  ChatActiveRestrictionSummary,
  ChatAdminOverviewResponse,
  ChatEventEnvelope,
  ChatMessageSummary,
  ChatModeratedUserSummary,
  ChatRestrictionsResponse,
  ChatUserSearchResponse,
} from "@/types/chat";

interface AdminChatConsoleProps {
  lang: string;
  dict: ChatDictionary;
  initialData: ChatAdminOverviewResponse;
  currentUserId: string;
}

type TabId = "live" | "restrictions" | "users" | "logs" | "review";

function formatTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function getLiftAction(restrictionType: ChatActiveRestrictionSummary["restrictionType"]) {
  switch (restrictionType) {
    case "timed_out":
      return "lift_timeout";
    case "banned":
      return "lift_ban";
    case "shadow_muted":
      return "lift_shadow_mute";
  }
}

export function AdminChatConsole({
  lang,
  dict,
  initialData,
  currentUserId,
}: AdminChatConsoleProps) {
  const copy = getChatUiCopy(lang, dict);
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabId>("live");
  const [data, setData] = useState(initialData);
  const [roomMode, setRoomMode] = useState(initialData.room.mode);
  const [slowModeSeconds, setSlowModeSeconds] = useState(
    String(initialData.room.slowModeSeconds)
  );
  const [restrictions, setRestrictions] = useState(initialData.restrictions);
  const [restrictionCounts, setRestrictionCounts] = useState(initialData.restrictionCounts);
  const [restrictionFilter, setRestrictionFilter] = useState<
    "all" | "timed_out" | "banned" | "shadow_muted"
  >("all");
  const [restrictionsLoading, setRestrictionsLoading] = useState(false);
  const [userQuery, setUserQuery] = useState("");
  const [userResults, setUserResults] = useState<ChatModeratedUserSummary[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userActionReason, setUserActionReason] = useState("");
  const [userActionMinutes, setUserActionMinutes] = useState("15");
  const [logs, setLogs] = useState(initialData.actions);
  const [logsTotal, setLogsTotal] = useState(initialData.actions.length);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logActor, setLogActor] = useState("");
  const [logTarget, setLogTarget] = useState("");
  const [logActionType, setLogActionType] = useState("all");
  const [logFrom, setLogFrom] = useState("");
  const [logTo, setLogTo] = useState("");

  const selectedUser =
    userResults.find((user) => user.userId === selectedUserId) ?? userResults[0] ?? null;
  const selectedUserRestriction = selectedUser?.activeRestriction ?? null;
  const selectedUserProtected = Boolean(
    selectedUser &&
      (selectedUser.userId === currentUserId ||
        selectedUser.role === "admin" ||
        selectedUser.role === "super_admin" ||
        selectedUser.role === "moderator")
  );

  const roomModeOptions = useMemo(
    () => [
      { value: "open", label: copy.roomModes.open },
      { value: "read_only", label: copy.roomModes.read_only },
      { value: "slow_mode", label: copy.roomModes.slow_mode },
      { value: "announcement_only", label: copy.roomModes.announcement_only },
    ],
    [
      copy.roomModes.announcement_only,
      copy.roomModes.open,
      copy.roomModes.read_only,
      copy.roomModes.slow_mode,
    ]
  );

  const restrictionFilterOptions = useMemo(
    () => [
      { value: "all", label: copy.admin.allRestrictions },
      { value: "timed_out", label: copy.admin.timeout },
      { value: "banned", label: copy.admin.ban },
      { value: "shadow_muted", label: copy.admin.shadowMute },
    ],
    [copy.admin.allRestrictions, copy.admin.ban, copy.admin.shadowMute, copy.admin.timeout]
  );

  const actionTypeOptions = useMemo(
    () => [
      { value: "all", label: copy.admin.allActions },
      { value: "timeout_user", label: copy.admin.timeout },
      { value: "lift_timeout", label: copy.admin.liftTimeout },
      { value: "ban_user", label: copy.admin.ban },
      { value: "lift_ban", label: copy.admin.liftBan },
      { value: "shadow_mute_user", label: copy.admin.shadowMute },
      { value: "lift_shadow_mute", label: copy.admin.liftShadowMute },
    ],
    [
      copy.admin.allActions,
      copy.admin.ban,
      copy.admin.liftBan,
      copy.admin.liftShadowMute,
      copy.admin.liftTimeout,
      copy.admin.shadowMute,
      copy.admin.timeout,
    ]
  );

  const tabs = useMemo(
    () =>
      [
        { id: "live", label: copy.admin.liveFeed },
        { id: "restrictions", label: copy.admin.activeRestrictions },
        { id: "users", label: copy.admin.userSearch },
        { id: "logs", label: copy.admin.auditLog },
        { id: "review", label: copy.admin.review },
      ] as Array<{ id: TabId; label: string }>,
    [
      copy.admin.activeRestrictions,
      copy.admin.auditLog,
      copy.admin.liveFeed,
      copy.admin.review,
      copy.admin.userSearch,
    ]
  );
  const liveMessages = useMemo(
    () =>
      [...data.messages].sort((a, b) => {
        const aOrder = a.visibleSeq ?? 0;
        const bOrder = b.visibleSeq ?? 0;
        if (aOrder !== bOrder) {
          return bOrder - aOrder;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }),
    [data.messages]
  );

  const loadAdminData = useCallback(async () => {
    const res = await fetch("/api/admin/chat", { cache: "no-store" });
    if (!res.ok) {
      throw new Error("load_failed");
    }
    const payload = (await res.json()) as ChatAdminOverviewResponse;
    setData(payload);
    setRoomMode(payload.room.mode);
    setSlowModeSeconds(String(payload.room.slowModeSeconds));
    setRestrictionCounts(payload.restrictionCounts);
    if (restrictionFilter === "all") {
      setRestrictions(payload.restrictions);
    }
    if (activeTab === "logs") {
      setLogs(payload.actions);
      setLogsTotal(payload.actions.length);
    }
  }, [activeTab, restrictionFilter]);

  const loadRestrictions = useCallback(
    async (status = restrictionFilter) => {
      setRestrictionsLoading(true);
      try {
        const searchParams = new URLSearchParams();
        if (status !== "all") {
          searchParams.set("status", status);
        }
        const res = await fetch(`/api/admin/chat/restrictions?${searchParams.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("load_failed");
        const payload = (await res.json()) as ChatRestrictionsResponse;
        setRestrictions(payload.restrictions);
        setRestrictionCounts(payload.counts);
      } catch {
        toast({ type: "error", title: copy.states.networkError });
      } finally {
        setRestrictionsLoading(false);
      }
    },
    [copy.states.networkError, restrictionFilter, toast]
  );

  const searchUsers = useCallback(
    async (query = userQuery) => {
      const trimmed = query.trim();
      if (!trimmed) {
        setUserResults([]);
        setSelectedUserId(null);
        return;
      }

      setUsersLoading(true);
      try {
        const res = await fetch(
          `/api/admin/chat/users?q=${encodeURIComponent(trimmed)}`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error("search_failed");
        const payload = (await res.json()) as ChatUserSearchResponse;
        setUserResults(payload.users);
        setSelectedUserId(payload.users[0]?.userId ?? null);
      } catch {
        toast({ type: "error", title: copy.states.networkError });
      } finally {
        setUsersLoading(false);
      }
    },
    [copy.states.networkError, toast, userQuery]
  );

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const searchParams = new URLSearchParams();
      if (logActor.trim()) searchParams.set("actor", logActor.trim());
      if (logTarget.trim()) searchParams.set("target", logTarget.trim());
      if (logActionType !== "all") searchParams.set("actionType", logActionType);
      if (logFrom) searchParams.set("from", new Date(logFrom).toISOString());
      if (logTo) searchParams.set("to", new Date(logTo).toISOString());

      const res = await fetch(`/api/admin/chat/logs?${searchParams.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("load_failed");
      const payload = (await res.json()) as ChatActionLogResponse;
      setLogs(payload.actions);
      setLogsTotal(payload.total);
    } catch {
      toast({ type: "error", title: copy.states.networkError });
    } finally {
      setLogsLoading(false);
    }
  }, [copy.states.networkError, logActionType, logActor, logFrom, logTarget, logTo, toast]);

  useEffect(() => {
    const source = new EventSource("/api/chat/events");
    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as ChatEventEnvelope;
        if (payload.type === "message_created") {
          const nextMessage = (payload.payload as { message: ChatMessageSummary }).message;
          setData((current) => ({
            ...current,
            messages: [
              ...current.messages.filter((item) => item.id !== nextMessage.id),
              nextMessage,
            ].sort((a, b) => (a.visibleSeq ?? 0) - (b.visibleSeq ?? 0)),
          }));
        }
        if (payload.type === "message_removed") {
          const removed = payload.payload as { messageId: string };
          setData((current) => ({
            ...current,
            messages: current.messages.map((item) =>
              item.id === removed.messageId
                ? { ...item, status: "deleted", body: copy.states.deleted, isDeleted: true }
                : item
            ),
          }));
        }
        if (payload.type === "room_state") {
          setData((current) => ({
            ...current,
            room: (payload.payload as { room: ChatAdminOverviewResponse["room"] }).room,
          }));
        }
        if (payload.type === "message_held" || payload.type === "moderation_updated") {
          void loadAdminData().catch(() => {});
          if (activeTab === "restrictions") {
            void loadRestrictions().catch(() => {});
          }
          if (activeTab === "logs") {
            void loadLogs().catch(() => {});
          }
          if (activeTab === "users" && userQuery.trim()) {
            void searchUsers(userQuery).catch(() => {});
          }
        }
      } catch {
        // ignore malformed event payloads
      }
    };
    return () => source.close();
  }, [
    activeTab,
    copy.states.deleted,
    loadAdminData,
    loadLogs,
    loadRestrictions,
    searchUsers,
    userQuery,
  ]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadAdminData().catch(() => {});
      if (activeTab === "restrictions") {
        void loadRestrictions().catch(() => {});
      }
      if (activeTab === "logs") {
        void loadLogs().catch(() => {});
      }
      if (activeTab === "users" && userQuery.trim()) {
        void searchUsers(userQuery).catch(() => {});
      }
    }, 15000);
    return () => window.clearInterval(interval);
  }, [activeTab, loadAdminData, loadLogs, loadRestrictions, searchUsers, userQuery]);

  useEffect(() => {
    if (activeTab === "restrictions") {
      void loadRestrictions().catch(() => {});
    }
    if (activeTab === "logs") {
      void loadLogs().catch(() => {});
    }
  }, [activeTab, loadLogs, loadRestrictions]);

  async function performAction(
    body: Record<string, unknown>,
    successTitle: string,
    options: { refreshUsers?: boolean } = {}
  ) {
    try {
      const res = await fetch("/api/admin/chat/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        toast({ type: "error", title: copy.states.networkError });
        return;
      }
      toast({ type: "success", title: successTitle });
      await loadAdminData();
      await Promise.all([
        loadRestrictions(),
        loadLogs(),
        options.refreshUsers && userQuery.trim() ? searchUsers(userQuery) : Promise.resolve(),
      ]);
    } catch {
      toast({ type: "error", title: copy.states.networkError });
    }
  }

  async function applyRoomSettings() {
    if (roomMode === "slow_mode") {
      await performAction(
        {
          action: "set_slow_mode",
          slowModeSeconds: Number.parseInt(slowModeSeconds || "0", 10) || 0,
        },
        copy.admin.apply
      );
      return;
    }

    await performAction({ action: "set_room_mode", roomMode }, copy.admin.apply);
  }

  function askReason(defaultText = "") {
    return window.prompt(copy.admin.reason, defaultText) ?? "";
  }

  function renderSourceMessage(body: string | null, visibleSeq: number | null) {
    if (!body) {
      return <p className="text-xs text-text-muted">{copy.admin.noSourceContext}</p>;
    }

    return (
      <div className="rounded-[12px] border border-white/6 bg-black/10 px-3 py-2">
        <p className="text-[11px] uppercase tracking-wider text-text-muted">
          {copy.admin.sourceMessage}
          {typeof visibleSeq === "number" ? ` #${visibleSeq}` : ""}
        </p>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-text-primary">
          {body}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card variant="soft" className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              {copy.page.online}
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-text-primary">
              {data.room.onlineCount}
            </p>
          </Card>
          <Card variant="soft" className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              {copy.admin.timeout}
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-text-primary">
              {restrictionCounts.timedOut}
            </p>
          </Card>
          <Card variant="soft" className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              {copy.admin.ban}
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-text-primary">
              {restrictionCounts.banned}
            </p>
          </Card>
          <Card variant="soft" className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              {copy.admin.shadowMute}
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-text-primary">
              {restrictionCounts.shadowMuted}
            </p>
          </Card>
        </div>

        <Card variant="topline" className="p-4">
          <div className="flex items-center gap-2 text-text-primary">
            <ShieldAlert className="h-4 w-4 text-pa-green" />
            <h3 className="text-sm font-semibold uppercase tracking-wider">
              {copy.admin.controls}
            </h3>
          </div>
          <div className="mt-4 space-y-3">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
                {copy.admin.roomMode}
              </p>
              <Select
                options={roomModeOptions}
                value={roomMode}
                onChange={(value) => setRoomMode(value as typeof roomMode)}
                className="w-full"
              />
            </div>
            <Input
              value={slowModeSeconds}
              onChange={(event) => setSlowModeSeconds(event.target.value)}
              label={copy.admin.slowMode}
            />
            <Button className="w-full" onClick={() => void applyRoomSettings()}>
              {copy.admin.apply}
            </Button>
          </div>
        </Card>
      </div>

      <Card variant="soft" className="p-2">
        <div className="flex flex-wrap items-center gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={[
                "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "bg-pa-green/12 text-pa-green"
                  : "text-text-secondary hover:bg-white/4 hover:text-text-primary",
              ].join(" ")}
            >
              {tab.label}
            </button>
          ))}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void loadAdminData()}
            className="ml-auto"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {copy.admin.refresh}
          </Button>
        </div>
      </Card>

      {activeTab === "live" ? (
        <Card variant="soft" className="p-4 md:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-text-primary">{copy.admin.liveFeed}</h3>
              <p className="mt-1 text-sm text-text-secondary">{copy.admin.subtitle}</p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {liveMessages.length === 0 ? (
              <p className="text-sm text-text-muted">{copy.page.empty}</p>
            ) : (
              liveMessages.map((message) => (
                <div
                  key={message.id}
                  className="rounded-[14px] border border-white/6 bg-white/3 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-text-primary">
                          {message.author?.name ?? "System"}
                        </span>
                        {message.author?.roleBadge ? (
                          <span className="rounded-full border border-pa-green/15 bg-pa-green/10 px-2 py-0.5 text-[10px] font-semibold text-pa-green">
                            {message.author.roleBadge}
                          </span>
                        ) : null}
                      </div>
                      <p
                        className={`mt-2 whitespace-pre-wrap break-words text-sm ${
                          message.isDeleted ? "italic text-text-muted" : "text-text-primary"
                        }`}
                      >
                        {message.body}
                      </p>
                    </div>
                    <time className="text-xs text-text-muted">
                      {formatTime(message.createdAt)}
                    </time>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant={message.isDeleted ? "secondary" : "danger"}
                      onClick={() =>
                        void performAction(
                          {
                            action: message.isDeleted ? "restore_message" : "delete_message",
                            messageId: message.id,
                            reason: askReason(),
                          },
                          message.isDeleted ? copy.admin.restore : copy.admin.delete
                        )
                      }
                    >
                      {message.isDeleted ? copy.admin.restore : copy.admin.delete}
                    </Button>
                    {!message.isDeleted && message.author?.id ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={
                          message.author.id === currentUserId ||
                          message.author.role === "admin" ||
                          message.author.role === "super_admin" ||
                          message.author.role === "moderator"
                        }
                        onClick={() =>
                          void performAction(
                            {
                              action: "timeout_user",
                              targetUserId: message.author?.id,
                              sourceMessageId: message.id,
                              reason: askReason(),
                              durationMinutes: 15,
                            },
                            copy.admin.timeout
                          )
                        }
                      >
                        {copy.admin.timeout}
                      </Button>
                    ) : null}
                    {!message.isDeleted && message.author?.id ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={
                          message.author.id === currentUserId ||
                          message.author.role === "admin" ||
                          message.author.role === "super_admin" ||
                          message.author.role === "moderator"
                        }
                        onClick={() =>
                          void performAction(
                            {
                              action: "ban_user",
                              targetUserId: message.author?.id,
                              sourceMessageId: message.id,
                              reason: askReason(),
                            },
                            copy.admin.ban
                          )
                        }
                      >
                        {copy.admin.ban}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      ) : null}
      {activeTab === "restrictions" ? (
        <Card variant="soft" className="p-4 md:p-5">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <h3 className="text-lg font-semibold text-text-primary">
                {copy.admin.activeRestrictions}
              </h3>
              <p className="mt-1 text-sm text-text-secondary">
                {copy.admin.restrictionsSubtitle}
              </p>
            </div>
            <div className="ml-auto w-full max-w-[240px]">
              <Select
                options={restrictionFilterOptions}
                value={restrictionFilter}
                onChange={(value) => {
                  const next = value as typeof restrictionFilter;
                  setRestrictionFilter(next);
                  void loadRestrictions(next);
                }}
                className="w-full"
              />
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {restrictionsLoading ? (
              <p className="text-sm text-text-muted">{copy.page.loading}</p>
            ) : restrictions.length === 0 ? (
              <p className="text-sm text-text-muted">{copy.admin.noRestrictions}</p>
            ) : (
              restrictions.map((restriction) => (
                <div
                  key={`${restriction.userId}:${restriction.restrictionType}`}
                  className="rounded-[14px] border border-white/6 bg-white/3 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-text-primary">
                          {restriction.name}
                        </span>
                        {restriction.username ? (
                          <span className="text-xs text-text-muted">
                            @{restriction.username}
                          </span>
                        ) : null}
                        <span className="rounded-full border border-pa-green/15 bg-pa-green/10 px-2 py-0.5 text-[10px] font-semibold text-pa-green">
                          {restriction.restrictionType}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-text-muted">
                        {restriction.email ?? "—"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        void performAction(
                          {
                            action: getLiftAction(restriction.restrictionType),
                            targetUserId: restriction.userId,
                            reason: askReason(),
                          },
                          restriction.restrictionType === "timed_out"
                            ? copy.admin.liftTimeout
                            : restriction.restrictionType === "banned"
                              ? copy.admin.liftBan
                              : copy.admin.liftShadowMute,
                          { refreshUsers: true }
                        )
                      }
                    >
                      {restriction.restrictionType === "timed_out"
                        ? copy.admin.liftTimeout
                        : restriction.restrictionType === "banned"
                          ? copy.admin.liftBan
                          : copy.admin.liftShadowMute}
                    </Button>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div className="space-y-2 text-sm">
                      <p className="text-text-secondary">
                        <span className="font-medium text-text-primary">
                          {copy.admin.imposedBy}:
                        </span>{" "}
                        {restriction.imposedBy ?? "—"}
                      </p>
                      <p className="text-text-secondary">
                        <span className="font-medium text-text-primary">
                          {copy.admin.imposedAt}:
                        </span>{" "}
                        {formatDateTime(restriction.imposedAt)}
                      </p>
                      <p className="text-text-secondary">
                        <span className="font-medium text-text-primary">
                          {copy.admin.expiresAt}:
                        </span>{" "}
                        {formatDateTime(restriction.expiresAt)}
                      </p>
                      <p className="text-text-secondary">
                        <span className="font-medium text-text-primary">
                          {copy.admin.reason}:
                        </span>{" "}
                        {restriction.reason || copy.admin.noReason}
                      </p>
                    </div>
                    {renderSourceMessage(
                      restriction.sourceMessageBody,
                      restriction.sourceVisibleSeq
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      ) : null}
      {activeTab === "users" ? (
        <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
          <Card variant="soft" className="p-4">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void searchUsers();
              }}
              className="flex gap-2"
            >
              <div className="flex-1">
                <Input
                  value={userQuery}
                  onChange={(event) => setUserQuery(event.target.value)}
                  label={copy.admin.userSearch}
                />
              </div>
              <Button type="submit" className="self-end">
                <Search className="h-4 w-4" />
              </Button>
            </form>

            <div className="mt-4 space-y-2">
              {usersLoading ? (
                <p className="text-sm text-text-muted">{copy.page.loading}</p>
              ) : userResults.length === 0 ? (
                <p className="text-sm text-text-muted">{copy.admin.noUsers}</p>
              ) : (
                userResults.map((user) => (
                  <button
                    key={user.userId}
                    type="button"
                    onClick={() => setSelectedUserId(user.userId)}
                    className={[
                      "w-full rounded-[12px] border px-3 py-3 text-left transition-colors",
                      selectedUser?.userId === user.userId
                        ? "border-pa-green/20 bg-pa-green/8"
                        : "border-white/6 bg-black/10 hover:border-white/12",
                    ].join(" ")}
                  >
                    <p className="text-sm font-semibold text-text-primary">{user.name}</p>
                    <p className="text-xs text-text-muted">
                      {user.username ? `@${user.username}` : user.email ?? "—"}
                    </p>
                    {user.activeRestriction ? (
                      <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-pa-green">
                        {user.activeRestriction.restrictionType}
                      </p>
                    ) : (
                      <p className="mt-2 text-[11px] uppercase tracking-wider text-text-muted">
                        {copy.admin.noRestrictions}
                      </p>
                    )}
                  </button>
                ))
              )}
            </div>
          </Card>

          <Card variant="soft" className="p-4">
            {selectedUser ? (
              <div className="space-y-6">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-text-primary">{selectedUser.name}</h3>
                    {selectedUser.username ? (
                      <span className="text-sm text-text-muted">@{selectedUser.username}</span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-text-secondary">
                    {selectedUser.email ?? "—"}
                  </p>
                  <p className="mt-2 text-xs uppercase tracking-wider text-text-muted">
                    {copy.admin.currentRestriction}:{" "}
                    <span className="text-text-primary">
                      {selectedUserRestriction?.restrictionType ?? selectedUser.chatStatus}
                    </span>
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_160px]">
                  <Input
                    value={userActionReason}
                    onChange={(event) => setUserActionReason(event.target.value)}
                    label={copy.admin.reason}
                  />
                  <Input
                    value={userActionMinutes}
                    onChange={(event) => setUserActionMinutes(event.target.value)}
                    label={copy.admin.minutes}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={selectedUserProtected}
                    onClick={() =>
                      void performAction(
                        {
                          action: "timeout_user",
                          targetUserId: selectedUser.userId,
                          reason: userActionReason || undefined,
                          durationMinutes: Number.parseInt(userActionMinutes || "15", 10) || 15,
                        },
                        copy.admin.timeout,
                        { refreshUsers: true }
                      )
                    }
                  >
                    <Clock3 className="mr-2 h-4 w-4" />
                    {copy.admin.timeout}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={selectedUserProtected}
                    onClick={() =>
                      void performAction(
                        {
                          action: "ban_user",
                          targetUserId: selectedUser.userId,
                          reason: userActionReason || undefined,
                        },
                        copy.admin.ban,
                        { refreshUsers: true }
                      )
                    }
                  >
                    <Ban className="mr-2 h-4 w-4" />
                    {copy.admin.ban}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={selectedUserProtected}
                    onClick={() =>
                      void performAction(
                        {
                          action: "shadow_mute_user",
                          targetUserId: selectedUser.userId,
                          reason: userActionReason || undefined,
                        },
                        copy.admin.shadowMute,
                        { refreshUsers: true }
                      )
                    }
                  >
                    <EyeOff className="mr-2 h-4 w-4" />
                    {copy.admin.shadowMute}
                  </Button>
                  {selectedUserRestriction ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        void performAction(
                          {
                            action: getLiftAction(selectedUserRestriction.restrictionType),
                            targetUserId: selectedUser.userId,
                            reason: userActionReason || undefined,
                          },
                          selectedUserRestriction.restrictionType === "timed_out"
                            ? copy.admin.liftTimeout
                            : selectedUserRestriction.restrictionType === "banned"
                              ? copy.admin.liftBan
                              : copy.admin.liftShadowMute,
                          { refreshUsers: true }
                        )
                      }
                    >
                      <ShieldOff className="mr-2 h-4 w-4" />
                      {selectedUserRestriction.restrictionType === "timed_out"
                        ? copy.admin.liftTimeout
                        : selectedUserRestriction.restrictionType === "banned"
                          ? copy.admin.liftBan
                          : copy.admin.liftShadowMute}
                    </Button>
                  ) : null}
                </div>
                {selectedUserProtected ? (
                  <p className="text-xs text-text-muted">
                    {copy.admin.protectedUser}
                  </p>
                ) : null}

                <div className="grid gap-4 xl:grid-cols-2">
                  <div>
                    <h4 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
                      {copy.admin.recentMessages}
                    </h4>
                    <div className="mt-3 space-y-3">
                      {selectedUser.recentMessages.length === 0 ? (
                        <p className="text-sm text-text-muted">{copy.page.empty}</p>
                      ) : (
                        selectedUser.recentMessages.map((message) => (
                          <div
                            key={message.id}
                            className="rounded-[12px] border border-white/6 bg-black/10 px-3 py-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs text-text-muted">
                                {formatDateTime(message.createdAt)}
                              </span>
                              <span className="text-xs uppercase tracking-wider text-text-muted">
                                {message.status}
                              </span>
                            </div>
                            <p className="mt-2 whitespace-pre-wrap break-words text-sm text-text-primary">
                              {message.body}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
                      {copy.admin.recentActions}
                    </h4>
                    <div className="mt-3 space-y-3">
                      {selectedUser.recentActions.length === 0 ? (
                        <p className="text-sm text-text-muted">{copy.admin.noActions}</p>
                      ) : (
                        selectedUser.recentActions.map((action) => (
                          <div
                            key={action.id}
                            className="rounded-[12px] border border-white/6 bg-black/10 px-3 py-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium text-text-primary">
                                {action.actionType}
                              </span>
                              <span className="text-xs text-text-muted">
                                {formatDateTime(action.createdAt)}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-text-secondary">
                              {action.reason || copy.admin.noReason}
                            </p>
                            {action.sourceMessageBody ? (
                              <p className="mt-2 whitespace-pre-wrap break-words text-xs text-text-muted">
                                {action.sourceMessageBody}
                              </p>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-text-muted">{copy.admin.noUsers}</p>
            )}
          </Card>
        </div>
      ) : null}
      {activeTab === "logs" ? (
        <Card variant="soft" className="p-4 md:p-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[180px] flex-1">
              <Input
                value={logTarget}
                onChange={(event) => setLogTarget(event.target.value)}
                label={copy.admin.targetFilter}
              />
            </div>
            <div className="min-w-[180px] flex-1">
              <Input
                value={logActor}
                onChange={(event) => setLogActor(event.target.value)}
                label={copy.admin.actorFilter}
              />
            </div>
            <div className="min-w-[180px] flex-1">
              <Select
                options={actionTypeOptions}
                value={logActionType}
                onChange={setLogActionType}
                className="w-full"
              />
            </div>
            <div className="min-w-[180px] flex-1">
              <Input
                type="datetime-local"
                value={logFrom}
                onChange={(event) => setLogFrom(event.target.value)}
                label={copy.admin.from}
              />
            </div>
            <div className="min-w-[180px] flex-1">
              <Input
                type="datetime-local"
                value={logTo}
                onChange={(event) => setLogTo(event.target.value)}
                label={copy.admin.to}
              />
            </div>
            <Button onClick={() => void loadLogs()}>{copy.admin.refresh}</Button>
          </div>

          <div className="mt-4 space-y-3">
            <p className="text-xs uppercase tracking-wider text-text-muted">
              {copy.admin.auditLog} · {logsTotal}
            </p>
            {logsLoading ? (
              <p className="text-sm text-text-muted">{copy.page.loading}</p>
            ) : logs.length === 0 ? (
              <p className="text-sm text-text-muted">{copy.admin.noActions}</p>
            ) : (
              logs.map((action) => (
                <div
                  key={action.id}
                  className="rounded-[14px] border border-white/6 bg-white/3 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-text-primary">
                        {action.actionType}
                      </span>
                      <span className="text-xs text-text-muted">
                        {action.actorName}
                        {action.actorUsername ? ` (@${action.actorUsername})` : ""}
                      </span>
                    </div>
                    <span className="text-xs text-text-muted">
                      {formatDateTime(action.createdAt)}
                    </span>
                  </div>
                  <div className="mt-2 grid gap-3 md:grid-cols-2">
                    <div className="space-y-2 text-sm text-text-secondary">
                      <p>
                        <span className="font-medium text-text-primary">
                          {copy.admin.targetFilter}:
                        </span>{" "}
                        {action.targetUserName || action.targetUserEmail || "—"}
                      </p>
                      <p>
                        <span className="font-medium text-text-primary">
                          {copy.admin.reason}:
                        </span>{" "}
                        {action.reason || copy.admin.noReason}
                      </p>
                      <p>
                        <span className="font-medium text-text-primary">
                          {copy.admin.expiresAt}:
                        </span>{" "}
                        {formatDateTime(action.expiresAt)}
                      </p>
                    </div>
                    {renderSourceMessage(action.sourceMessageBody, action.sourceVisibleSeq)}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      ) : null}
      {activeTab === "review" ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card variant="accent" className="p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
              {copy.admin.heldQueue}
            </h3>
            <p className="mt-2 text-sm text-text-secondary">
              {copy.admin.heldQueueDescription}
            </p>
            <div className="mt-3 space-y-3">
              {data.heldMessages.length === 0 ? (
                <p className="text-sm text-text-muted">{copy.admin.noHeld}</p>
              ) : (
                data.heldMessages.map((message) => (
                  <div
                    key={message.id}
                    className="rounded-[12px] border border-white/6 bg-black/10 p-3"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                      {message.author?.name ?? "Nutzer"}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm text-text-primary">
                      {message.body}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        onClick={() =>
                          void performAction(
                            { action: "approve_message", messageId: message.id },
                            copy.admin.approve
                          )
                        }
                      >
                        {copy.admin.approve}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() =>
                          void performAction(
                            {
                              action: "reject_message",
                              messageId: message.id,
                              reason: askReason(),
                            },
                            copy.admin.reject
                          )
                        }
                      >
                        {copy.admin.reject}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card variant="soft" className="p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
              {copy.admin.reportsQueue}
            </h3>
            <div className="mt-3 space-y-3">
              {data.reports.length === 0 ? (
                <p className="text-sm text-text-muted">{copy.admin.noReports}</p>
              ) : (
                data.reports.map((report) => (
                  <div
                    key={report.id}
                    className="rounded-[12px] border border-white/6 bg-black/10 p-3"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                      {report.category}
                    </p>
                    <p className="mt-2 text-sm text-text-primary">
                      {report.note || report.messageId}
                    </p>
                    <p className="mt-1 text-xs text-text-muted">{report.reporterName}</p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
