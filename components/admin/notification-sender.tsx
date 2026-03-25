"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

type RecipientType = "user" | "role" | "all";
type NotificationType = "info" | "success" | "warning" | "error";

const ROLES = ["user", "shop", "moderator", "admin", "super_admin"];
const NOTIFICATION_TYPES: { value: NotificationType; label: string }[] = [
  { value: "info", label: "Info" },
  { value: "success", label: "Success" },
  { value: "warning", label: "Warning" },
  { value: "error", label: "Error" },
];

export function NotificationSender() {
  const [recipientType, setRecipientType] = useState<RecipientType>("all");
  const [userValue, setUserValue] = useState("");
  const [roleValue, setRoleValue] = useState("user");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [notifType, setNotifType] = useState<NotificationType>("info");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      toast({ type: "error", title: "Title and message are required" });
      return;
    }

    const recipient: { type: RecipientType; value?: string } = {
      type: recipientType,
    };
    if (recipientType === "user") recipient.value = userValue.trim();
    if (recipientType === "role") recipient.value = roleValue;

    const body: Record<string, unknown> = {
      recipient,
      title: title.trim(),
      message: message.trim(),
      type: notifType,
    };

    if (ctaLabel.trim() && ctaUrl.trim()) {
      body.cta = { label: ctaLabel.trim(), url: ctaUrl.trim() };
    }

    setSending(true);
    try {
      const res = await fetch("/api/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({ type: "error", title: data.error ?? "Failed to send" });
        return;
      }

      toast({
        type: "success",
        title: `Sent to ${data.count} user${data.count !== 1 ? "s" : ""}`,
      });

      // Reset form
      setTitle("");
      setMessage("");
      setCtaLabel("");
      setCtaUrl("");
      setUserValue("");
    } catch {
      toast({ type: "error", title: "Network error" });
    } finally {
      setSending(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-surface border border-border rounded-[14px] p-6 space-y-5"
    >
      <h3 className="text-base font-semibold text-text-primary">Send Notification</h3>

      {/* Recipient Type */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-text-secondary">
          Recipient
        </label>
        <div className="flex flex-wrap gap-3">
          {(["user", "role", "all"] as RecipientType[]).map((t) => (
            <label key={t} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="recipientType"
                value={t}
                checked={recipientType === t}
                onChange={() => setRecipientType(t)}
                className="accent-pa-green"
              />
              <span className="text-sm text-text-primary capitalize">
                {t === "user" ? "Single User" : t === "role" ? "By Role" : "All Users"}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Conditional recipient inputs */}
      {recipientType === "user" && (
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-text-secondary">
            Username or Email
          </label>
          <Input
            value={userValue}
            onChange={(e) => setUserValue(e.target.value)}
            placeholder="user@example.com or username"
            className="py-2 text-sm"
          />
        </div>
      )}

      {recipientType === "role" && (
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-text-secondary">
            Role
          </label>
          <select
            value={roleValue}
            onChange={(e) => setRoleValue(e.target.value)}
            className="bg-white/4 border border-white/8 text-text-primary text-sm rounded-[10px] px-3 py-2 outline-none focus:border-pa-green/35 w-full max-w-xs"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Title */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-text-secondary">
          Title
        </label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Notification title"
          className="py-2 text-sm"
          maxLength={200}
        />
      </div>

      {/* Message */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-text-secondary">
          Message
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Notification message…"
          rows={3}
          className="w-full bg-white/4 border border-white/8 text-text-primary text-sm rounded-[10px] px-3 py-2 outline-none focus:border-pa-green/35 resize-y"
          maxLength={1000}
        />
      </div>

      {/* Type */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-text-secondary">
          Type
        </label>
        <select
          value={notifType}
          onChange={(e) => setNotifType(e.target.value as NotificationType)}
          className="bg-white/4 border border-white/8 text-text-primary text-sm rounded-[10px] px-3 py-2 outline-none focus:border-pa-green/35"
        >
          {NOTIFICATION_TYPES.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* CTA (optional) */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-text-secondary">
          Call to Action (optional)
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            value={ctaLabel}
            onChange={(e) => setCtaLabel(e.target.value)}
            placeholder="Button label"
            className="py-2 text-sm"
          />
          <Input
            value={ctaUrl}
            onChange={(e) => setCtaUrl(e.target.value)}
            placeholder="https://…"
            className="py-2 text-sm"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={sending}
        className="px-4 py-2 bg-pa-green text-black text-sm font-semibold rounded-[10px] hover:bg-pa-green/85 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {sending ? "Sending…" : "Send Notification"}
      </button>
    </form>
  );
}
