"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { FEEDBACK_KINDS } from "@/lib/feedback-constants";
import {
  getFeedbackKindLabel,
  getFeedbackUiCopy,
  resolveFeedbackError,
  type FeedbackDictionary,
} from "@/lib/feedback-i18n";
import { FeedbackAttachmentPicker } from "@/components/feedback/feedback-attachment-picker";

interface FeedbackFormProps {
  lang: string;
  dict?: FeedbackDictionary;
}

export function FeedbackForm({ lang, dict = {} }: FeedbackFormProps) {
  const copy = getFeedbackUiCopy(lang, dict);
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [kind, setKind] = useState<(typeof FEEDBACK_KINDS)[number]>("bug_report");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();

    if (trimmedTitle.length < 4 || trimmedDescription.length < 10) {
      toast({ type: "error", title: copy.form.requiredError });
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.set("kind", kind);
      formData.set("title", trimmedTitle);
      formData.set("description", trimmedDescription);
      formData.set(
        "source",
        pathname.includes("settings") ? "settings" : pathname.includes("account") ? "account" : "dashboard"
      );
      formData.set(
        "context",
        JSON.stringify({
          route: pathname,
          locale: lang,
          userAgent: typeof window !== "undefined" ? window.navigator.userAgent : null,
          viewportWidth: typeof window !== "undefined" ? window.innerWidth : null,
          viewportHeight: typeof window !== "undefined" ? window.innerHeight : null,
        })
      );

      for (const attachment of attachments) {
        formData.append("attachments", attachment);
      }

      const res = await fetch("/api/feedback", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        toast({
          type: "error",
          title: resolveFeedbackError(lang, data.error, dict, copy.form.createError),
        });
        return;
      }

      toast({ type: "success", title: copy.form.createdSuccess });
      router.push(`/${lang}/feedback/${data.feedback.id}`);
      router.refresh();
    } catch {
      toast({ type: "error", title: copy.common.networkError });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 md:items-start">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-secondary">{copy.form.typeLabel}</label>
          <Select
            options={FEEDBACK_KINDS.map((value) => ({ value, label: getFeedbackKindLabel(lang, value, dict) }))}
            value={kind}
            onChange={(value) => setKind(value as (typeof FEEDBACK_KINDS)[number])}
            className="w-full"
          />
        </div>
        <Input
          label={copy.form.titleLabel}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={150}
          placeholder={copy.form.titlePlaceholder}
          className="h-[42px] px-3.5 py-2.5 text-sm leading-5"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-text-secondary">{copy.form.detailsLabel}</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={8}
          maxLength={5000}
          placeholder={copy.form.detailsPlaceholder}
          className="w-full rounded-[10px] border border-white/8 bg-white/3 px-4 py-3 text-sm text-text-primary outline-none focus:border-pa-green/35 focus:ring-2 focus:ring-pa-green/6"
        />
      </div>

      <FeedbackAttachmentPicker lang={lang} dict={dict} files={attachments} onChange={setAttachments} />

      <div className="flex justify-end">
        <Button type="submit" variant="primary" loading={saving}>
          {copy.common.submit}
        </Button>
      </div>
    </form>
  );
}
