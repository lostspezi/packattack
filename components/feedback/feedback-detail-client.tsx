"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import {
  FEEDBACK_KINDS,
  FEEDBACK_PRIORITIES,
  FEEDBACK_SEVERITIES,
  FEEDBACK_STATUSES,
  FEEDBACK_WAITING_ON,
  type FeedbackKind,
  type FeedbackPriority,
  type FeedbackSeverity,
  type FeedbackStatus,
} from "@/lib/feedback-constants";
import {
  formatFeedbackAuditMessage,
  getFeedbackActorLabel,
  getFeedbackKindLabel,
  getFeedbackMessageCountLabel,
  getFeedbackPriorityLabel,
  getFeedbackSeverityLabel,
  getFeedbackStatusLabel,
  getFeedbackUiCopy,
  getFeedbackWaitingLabel,
  resolveFeedbackError,
  type FeedbackDictionary,
} from "@/lib/feedback-i18n";
import type { FeedbackDetailResponse, FeedbackMessageSummary } from "@/types/feedback";
import {
  FeedbackKindBadge,
  FeedbackPriorityBadge,
  FeedbackSeverityBadge,
  FeedbackStatusBadge,
  formatFeedbackDate,
} from "@/components/feedback/feedback-badges";
import { FeedbackAttachmentList } from "@/components/feedback/feedback-attachment-list";
import { FeedbackAttachmentPicker } from "@/components/feedback/feedback-attachment-picker";

interface FeedbackDetailClientProps {
  lang: string;
  feedbackId: string;
  dict?: FeedbackDictionary;
  mode?: "user" | "staff";
}

const textareaClassName = "w-full rounded-[10px] border border-white/8 bg-white/3 px-4 py-3 text-sm text-text-primary outline-none focus:border-pa-green/35 focus:ring-2 focus:ring-pa-green/6";

export function FeedbackDetailClient({ lang, feedbackId, dict = {}, mode = "user" }: FeedbackDetailClientProps) {
  const copy = getFeedbackUiCopy(lang, dict);
  const { toast } = useToast();
  const [data, setData] = useState<FeedbackDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyBody, setReplyBody] = useState("");
  const [replyAttachments, setReplyAttachments] = useState<File[]>([]);
  const [replyInternal, setReplyInternal] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [editTicketOpen, setEditTicketOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editKind, setEditKind] = useState<FeedbackKind>("bug_report");
  const [savingTicket, setSavingTicket] = useState(false);
  const [editingMessage, setEditingMessage] = useState<FeedbackMessageSummary | null>(null);
  const [editMessageBody, setEditMessageBody] = useState("");
  const [savingMessage, setSavingMessage] = useState(false);
  const [status, setStatus] = useState<FeedbackStatus>("new");
  const [waitingOn, setWaitingOn] = useState<(typeof FEEDBACK_WAITING_ON)[number]>("staff");
  const [priority, setPriority] = useState<FeedbackPriority>("medium");
  const [severity, setSeverity] = useState<FeedbackSeverity>("minor");
  const [assignee, setAssignee] = useState("");
  const [areaTags, setAreaTags] = useState("");
  const [issueTags, setIssueTags] = useState("");
  const [savingTriage, setSavingTriage] = useState(false);
  const [staffUsers, setStaffUsers] = useState<{ id: string; name: string; username: string }[]>([]);

  useEffect(() => {
    async function loadStaffUsers() {
      if (mode !== "staff") return;
      try {
        const res = await fetch("/api/admin/users?role=admin,super_admin&limit=100");
        if (res.ok) {
          const payload = await res.json();
          setStaffUsers(payload.users.map((u: { _id: string; name: string; username: string }) => ({
            id: u._id,
            name: u.name,
            username: u.username,
          })));
        }
      } catch (err) {
        console.error("Failed to load staff users:", err);
      }
    }
    loadStaffUsers();
  }, [mode]);

  useEffect(() => {
    let active = true;

    async function loadDetail() {
      setLoading(true);
      try {
        const res = await fetch(`/api/feedback/${feedbackId}`);
        const payload = await res.json();

        if (!res.ok) {
          toast({ type: "error", title: resolveFeedbackError(lang, payload.error, dict, copy.detail.loadError) });
          return;
        }

        if (!active) return;

        const detail = payload as FeedbackDetailResponse;
        setData(detail);
        setEditTitle(detail.feedback.title);
        setEditDescription(detail.feedback.description);
        setEditKind(detail.feedback.kind);
        setStatus(detail.feedback.status);
        setWaitingOn(detail.feedback.waitingOn);
        setPriority(detail.feedback.priority);
        setSeverity(detail.feedback.severity);
        setAssignee(detail.feedback.assignedTo?.username ?? detail.feedback.assignedTo?.email ?? "");
        setAreaTags(detail.feedback.areaTags.join(", "));
        setIssueTags(detail.feedback.issueTags.join(", "));
      } catch {
        toast({ type: "error", title: copy.common.networkError });
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadDetail();
    return () => {
      active = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- dict and lang are stable page-level props
  }, [copy.common.networkError, copy.detail.loadError, feedbackId, toast]);

  async function refreshFromResponse(res: Response) {
    const payload = await res.json();
    if (!res.ok) {
      toast({ type: "error", title: resolveFeedbackError(lang, payload.error, dict, copy.detail.requestFailed) });
      return null;
    }

    const detail = payload as FeedbackDetailResponse;
    setData(detail);
    setEditTitle(detail.feedback.title);
    setEditDescription(detail.feedback.description);
    setEditKind(detail.feedback.kind);
    setStatus(detail.feedback.status);
    setWaitingOn(detail.feedback.waitingOn);
    setPriority(detail.feedback.priority);
    setSeverity(detail.feedback.severity);
    setAssignee(detail.feedback.assignedTo?.username ?? detail.feedback.assignedTo?.email ?? "");
    setAreaTags(detail.feedback.areaTags.join(", "));
    setIssueTags(detail.feedback.issueTags.join(", "));
    return detail;
  }

  async function handleSaveTicket() {
    setSavingTicket(true);
    try {
      const res = await fetch(`/api/feedback/${feedbackId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim(),
          kind: editKind,
        }),
      });

      const detail = await refreshFromResponse(res);
      if (detail) {
        toast({ type: "success", title: copy.detail.ticketUpdated });
        setEditTicketOpen(false);
      }
    } catch {
      toast({ type: "error", title: copy.common.networkError });
    } finally {
      setSavingTicket(false);
    }
  }

  async function handleReplySubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!replyBody.trim() && replyAttachments.length === 0) {
      toast({ type: "error", title: copy.detail.replyRequired });
      return;
    }

    setSendingReply(true);
    try {
      const formData = new FormData();
      formData.set("body", replyBody.trim());
      if (mode === "staff") {
        formData.set("isInternal", String(replyInternal));
      }
      for (const attachment of replyAttachments) {
        formData.append("attachments", attachment);
      }

      const res = await fetch(`/api/feedback/${feedbackId}/messages`, {
        method: "POST",
        body: formData,
      });

      const detail = await refreshFromResponse(res);
      if (detail) {
        toast({ type: "success", title: replyInternal ? copy.detail.internalNoteSaved : copy.detail.replySent });
        setReplyBody("");
        setReplyAttachments([]);
        setReplyInternal(false);
      }
    } catch {
      toast({ type: "error", title: copy.common.networkError });
    } finally {
      setSendingReply(false);
    }
  }

  async function handleMessageSave() {
    if (!editingMessage) return;
    if (!editMessageBody.trim()) {
      toast({ type: "error", title: copy.detail.replyRequired });
      return;
    }

    setSavingMessage(true);
    try {
      const res = await fetch(`/api/feedback/${feedbackId}/messages/${editingMessage.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: editMessageBody.trim() }),
      });

      const detail = await refreshFromResponse(res);
      if (detail) {
        toast({ type: "success", title: copy.detail.messageUpdated });
        setEditingMessage(null);
        setEditMessageBody("");
      }
    } catch {
      toast({ type: "error", title: copy.common.networkError });
    } finally {
      setSavingMessage(false);
    }
  }

  async function handleTriageSave() {
    setSavingTriage(true);
    try {
      const res = await fetch(`/api/feedback/${feedbackId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          waitingOn,
          priority,
          severity,
          assignedTo: assignee.trim() || null,
          areaTags: areaTags.split(",").map((entry) => entry.trim()).filter(Boolean),
          issueTags: issueTags.split(",").map((entry) => entry.trim()).filter(Boolean),
        }),
      });

      const detail = await refreshFromResponse(res);
      if (detail) {
        toast({ type: "success", title: copy.detail.triageSaved });
      }
    } catch {
      toast({ type: "error", title: copy.common.networkError });
    } finally {
      setSavingTriage(false);
    }
  }

  if (loading || !data) {
    return (
      <Card variant="soft" className="p-6 text-sm text-text-muted">
        {copy.detail.loadingTicket}
      </Card>
    );
  }

  const { feedback, messages, auditLogs } = data;
  const showStaffControls = mode === "staff" && feedback.isStaffView;

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_360px]">
        <div className="space-y-6">
          <Card variant="topline" className="p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">{feedback.ticketNo}</span>
                  <FeedbackStatusBadge status={feedback.status} lang={lang} dict={dict} />
                  <FeedbackKindBadge kind={feedback.kind} lang={lang} dict={dict} />
                  {showStaffControls && <FeedbackPriorityBadge priority={feedback.priority} lang={lang} dict={dict} />}
                  {showStaffControls && <FeedbackSeverityBadge severity={feedback.severity} lang={lang} dict={dict} />}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-text-primary">{feedback.title}</h2>
                  <p className="mt-3 text-sm text-text-secondary">{feedback.description}</p>
                </div>
                <div className="grid gap-2 text-sm text-text-secondary md:grid-cols-2">
                  <p>{copy.common.created}: <span className="text-text-primary">{formatFeedbackDate(feedback.createdAt, lang)}</span></p>
                  <p>{copy.common.lastActivity}: <span className="text-text-primary">{formatFeedbackDate(feedback.lastActivityAt, lang)}</span></p>
                  <p>{copy.common.waiting}: <span className="text-text-primary">{getFeedbackWaitingLabel(lang, feedback.waitingOn, dict)}</span></p>
                  <p>{copy.common.assigned}: <span className="text-text-primary">{feedback.assignedTo?.name ?? copy.common.unassigned}</span></p>
                </div>
                <FeedbackAttachmentList lang={lang} dict={dict} attachments={feedback.attachments} />
              </div>

              {feedback.canEdit && (
                <Button variant="secondary" onClick={() => setEditTicketOpen(true)}>
                  {copy.detail.editTicket}
                </Button>
              )}
            </div>
          </Card>

          <Card variant="soft" className="space-y-5 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text-primary">{copy.detail.conversation}</h3>
              <span className="text-xs text-text-muted">{getFeedbackMessageCountLabel(lang, messages.length, dict)}</span>
            </div>

            <div className="space-y-4">
              {messages.length === 0 ? (
                <div className="rounded-[12px] border border-white/8 bg-white/3 p-4 text-sm text-text-muted">
                  {copy.detail.noReplies}
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={[
                      "rounded-[12px] border p-4",
                      message.isInternal
                        ? "border-yellow-400/20 bg-yellow-500/8"
                        : message.authorType === "staff"
                          ? "border-pa-green/15 bg-pa-green/5"
                          : "border-white/8 bg-white/3",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-text-primary">
                          {message.author?.name ?? getFeedbackActorLabel(lang, message.authorType, dict)}
                          {message.isInternal && (
                            <span className="ml-2 text-xs font-medium uppercase tracking-wider text-yellow-300">{copy.detail.internalNoteLabel}</span>
                          )}
                        </p>
                        <p className="mt-1 text-xs text-text-muted">
                          {formatFeedbackDate(message.createdAt, lang)}
                          {message.editedAt ? ` · ${copy.common.updated} ${formatFeedbackDate(message.editedAt, lang)}` : ""}
                        </p>
                      </div>

                      {message.canEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingMessage(message);
                            setEditMessageBody(message.body);
                          }}
                        >
                          {copy.common.edit}
                        </Button>
                      )}
                    </div>

                    {message.body && (
                      <p className="mt-3 whitespace-pre-wrap text-sm text-text-secondary">{message.body}</p>
                    )}
                    <div className={message.body ? "mt-4" : "mt-3"}>
                      <FeedbackAttachmentList lang={lang} dict={dict} attachments={message.attachments} compact />
                    </div>
                  </div>
                ))
              )}
            </div>

            {feedback.canReply && (
              <form onSubmit={handleReplySubmit} className="space-y-4 border-t border-border pt-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-text-secondary">
                    {showStaffControls && replyInternal ? copy.detail.internalNoteLabel : copy.detail.replyLabel}
                  </label>
                  <textarea
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    rows={4}
                    placeholder={showStaffControls && replyInternal ? copy.detail.internalNotePlaceholder : copy.detail.replyPlaceholder}
                    className={textareaClassName}
                  />
                </div>

                <FeedbackAttachmentPicker lang={lang} dict={dict} files={replyAttachments} onChange={setReplyAttachments} />

                {showStaffControls && (
                  <label className="flex items-center gap-2 text-sm text-text-secondary">
                    <input
                      type="checkbox"
                      checked={replyInternal}
                      onChange={(e) => setReplyInternal(e.target.checked)}
                      className="accent-pa-green"
                    />
                    {copy.common.addInternalNote}
                  </label>
                )}

                <div className="flex justify-end">
                  <Button type="submit" variant="primary" loading={sendingReply}>
                    {replyInternal ? copy.common.addInternalNote : copy.common.sendReply}
                  </Button>
                </div>
              </form>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          {showStaffControls && (
            <Card variant="cut" className="space-y-4 p-5">
              <div>
                <h3 className="text-base font-semibold text-text-primary">{copy.detail.triageTitle}</h3>
                <p className="mt-1 text-sm text-text-secondary">{copy.detail.triageSubtitle}</p>
              </div>

              <div className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-text-secondary">{copy.detail.statusLabel}</label>
                    <Select
                      options={FEEDBACK_STATUSES.map((value) => ({ value, label: getFeedbackStatusLabel(lang, value, dict) }))}
                      value={status}
                      onChange={(value) => setStatus(value as FeedbackStatus)}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-text-secondary">{copy.detail.waitingLabel}</label>
                    <Select
                      options={FEEDBACK_WAITING_ON.map((value) => ({ value, label: getFeedbackWaitingLabel(lang, value, dict) }))}
                      value={waitingOn}
                      onChange={(value) => setWaitingOn(value as (typeof FEEDBACK_WAITING_ON)[number])}
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-text-secondary">{copy.detail.priorityLabel}</label>
                    <Select
                      options={FEEDBACK_PRIORITIES.map((value) => ({ value, label: getFeedbackPriorityLabel(lang, value, dict) }))}
                      value={priority}
                      onChange={(value) => setPriority(value as FeedbackPriority)}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-text-secondary">{copy.detail.severityLabel}</label>
                    <Select
                      options={FEEDBACK_SEVERITIES.map((value) => ({ value, label: getFeedbackSeverityLabel(lang, value, dict) }))}
                      value={severity}
                      onChange={(value) => setSeverity(value as FeedbackSeverity)}
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-text-secondary">{copy.detail.assigneeLabel}</label>
                  <Select
                    options={[
                      { value: "", label: copy.common.unassigned || "Unassigned" },
                      ...staffUsers.map((u) => ({
                        value: u.username,
                        label: `${u.username}${u.name ? ` (${u.name})` : ""}`,
                      })),
                    ]}
                    value={assignee}
                    onChange={(value) => setAssignee(value)}
                    className="w-full"
                  />
                </div>
                <Input
                  label={copy.detail.areaTagsLabel}
                  value={areaTags}
                  onChange={(e) => setAreaTags(e.target.value)}
                  placeholder={copy.detail.areaTagsPlaceholder}
                />
                <Input
                  label={copy.detail.issueTagsLabel}
                  value={issueTags}
                  onChange={(e) => setIssueTags(e.target.value)}
                  placeholder={copy.detail.issueTagsPlaceholder}
                />
              </div>

              <div className="flex justify-end">
                <Button variant="primary" loading={savingTriage} onClick={() => void handleTriageSave()}>
                  {copy.detail.saveTriage}
                </Button>
              </div>
            </Card>
          )}

          <Card variant="soft" className="space-y-4 p-5">
            <div>
              <h3 className="text-base font-semibold text-text-primary">{copy.detail.activityLog}</h3>
              <p className="mt-1 text-sm text-text-secondary">{copy.detail.activitySubtitle}</p>
            </div>

            <div className="space-y-3">
              {auditLogs.length === 0 ? (
                <p className="text-sm text-text-muted">{copy.detail.noActivity}</p>
              ) : (
                auditLogs.map((entry) => (
                  <div key={entry.id} className="rounded-[10px] border border-white/8 bg-white/3 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-text-primary">{formatFeedbackAuditMessage(lang, entry, dict)}</p>
                        <p className="mt-1 text-xs text-text-muted">
                          {entry.actor?.name ?? getFeedbackActorLabel(lang, entry.actorType, dict)}
                          {entry.visibility === "internal" ? ` · ${copy.detail.internalNoteLabel}` : ""}
                        </p>
                      </div>
                      <p className="text-xs text-text-muted">{formatFeedbackDate(entry.createdAt, lang)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      <Modal open={editTicketOpen} onClose={() => setEditTicketOpen(false)} title={copy.detail.editTicket} size="lg">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-secondary">{copy.form.typeLabel}</label>
            <Select
              options={FEEDBACK_KINDS.map((value) => ({ value, label: getFeedbackKindLabel(lang, value, dict) }))}
              value={editKind}
              onChange={(value) => setEditKind(value as FeedbackKind)}
              className="w-full"
            />
          </div>
          <Input label={copy.form.titleLabel} value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-secondary">{copy.detail.descriptionLabel}</label>
            <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={8} className={textareaClassName} />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setEditTicketOpen(false)}>
              {copy.common.cancel}
            </Button>
            <Button variant="primary" loading={savingTicket} onClick={() => void handleSaveTicket()}>
              {copy.detail.saveChanges}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={editingMessage !== null} onClose={() => setEditingMessage(null)} title={copy.detail.editMessage} size="lg">
        <div className="space-y-4">
          <textarea value={editMessageBody} onChange={(e) => setEditMessageBody(e.target.value)} rows={8} className={textareaClassName} />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setEditingMessage(null)}>
              {copy.common.cancel}
            </Button>
            <Button variant="primary" loading={savingMessage} onClick={() => void handleMessageSave()}>
              {copy.detail.saveChanges}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
