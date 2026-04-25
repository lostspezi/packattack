"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { SelectOption } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import {
  UpvoteCampaignItemPicker,
  type PickerItem,
} from "@/components/admin/upvote-campaign-item-picker";

interface CampaignDoc {
  _id: string;
  title: { de: string; en: string };
  description: { de: string; en: string };
  question: { de: string; en: string };
  status: "draft" | "active" | "closed";
  topN: number;
  items: Array<{
    _id: string;
    kind: "card" | "option" | "box";
    label: { de: string; en: string };
    description: { de: string; en: string };
    image: string | null;
    position: number;
    source: "internal" | "justtcg" | null;
    internalCardId: string | null;
    justTcgId: string | null;
    game: string | null;
    set: string | null;
    setName: string | null;
    rarity: string | null;
    tcgplayerId: string | null;
    boxId: string | null;
    boxSlug: string | null;
  }>;
  endsAt: string | null;
  closedAt: string | null;
}

interface CreateProps {
  lang: string;
  dict: Record<string, string>;
  mode: "create";
}

interface EditProps {
  lang: string;
  dict: Record<string, string>;
  mode: "edit";
  campaign: CampaignDoc;
  onUpdated: (campaign: CampaignDoc) => void;
}

type Props = CreateProps | EditProps;

const TOPN_OPTIONS: SelectOption[] = [
  { label: "1", value: "1" },
  { label: "3", value: "3" },
  { label: "5", value: "5" },
  { label: "10", value: "10" },
];

export function UpvoteCampaignForm(props: Props) {
  const { lang, dict, mode } = props;
  const isDe = lang === "de";
  const router = useRouter();
  const { toast } = useToast();

  const initialCampaign = mode === "edit" ? props.campaign : null;

  const [titleDe, setTitleDe] = useState(initialCampaign?.title.de ?? "");
  const [titleEn, setTitleEn] = useState(initialCampaign?.title.en ?? "");
  const [descDe, setDescDe] = useState(initialCampaign?.description.de ?? "");
  const [descEn, setDescEn] = useState(initialCampaign?.description.en ?? "");
  const [questionDe, setQuestionDe] = useState(initialCampaign?.question.de ?? "");
  const [questionEn, setQuestionEn] = useState(initialCampaign?.question.en ?? "");
  const [topN, setTopN] = useState(String(initialCampaign?.topN ?? 3));
  const [endsAt, setEndsAt] = useState(
    initialCampaign?.endsAt ? new Date(initialCampaign.endsAt).toISOString().slice(0, 16) : ""
  );
  const [items, setItems] = useState<PickerItem[]>(
    initialCampaign?.items.map((c) => ({
      kind: c.kind,
      label: c.label,
      description: c.description,
      image: c.image,
      source: c.source ?? undefined,
      internalCardId: c.internalCardId ?? undefined,
      justTcgId: c.justTcgId ?? undefined,
      game: c.game ?? undefined,
      set: c.set ?? undefined,
      setName: c.setName ?? undefined,
      rarity: c.rarity ?? undefined,
      tcgplayerId: c.tcgplayerId ?? undefined,
      boxId: c.boxId ?? undefined,
      boxSlug: c.boxSlug ?? undefined,
    })) ?? []
  );
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<"activate" | "close" | "duplicate" | "delete" | null>(null);

  const status = initialCampaign?.status ?? "draft";
  const itemsLocked = mode === "edit" && status !== "draft";
  const topNLocked = mode === "edit" && status !== "draft";

  const buildPayload = useCallback(() => {
    const itemPayload = items.map((item, idx) => {
      if (item.kind === "card") {
        if (item.source === "internal") {
          return {
            kind: "card" as const,
            source: "internal" as const,
            internalCardId: item.internalCardId,
            position: idx,
          };
        }
        return {
          kind: "card" as const,
          source: "justtcg" as const,
          justTcgId: item.justTcgId,
          name: item.label.de,
          game: item.game,
          set: item.set,
          setName: item.setName,
          rarity: item.rarity,
          image: item.image,
          tcgplayerId: item.tcgplayerId,
          position: idx,
        };
      }
      if (item.kind === "box") {
        return {
          kind: "box" as const,
          boxId: item.boxId,
          position: idx,
        };
      }
      return {
        kind: "option" as const,
        label: item.label,
        description: item.description,
        image: item.image,
        position: idx,
      };
    });

    return {
      title: { de: titleDe.trim(), en: titleEn.trim() },
      description: { de: descDe.trim(), en: descEn.trim() },
      question: { de: questionDe.trim(), en: questionEn.trim() },
      topN: Number.parseInt(topN, 10),
      endsAt: endsAt ? new Date(endsAt).toISOString() : null,
      items: itemPayload,
    };
  }, [titleDe, titleEn, descDe, descEn, questionDe, questionEn, topN, endsAt, items]);

  const validate = useCallback(() => {
    if (!titleDe.trim() || !titleEn.trim()) {
      return isDe ? "Titel ist Pflicht (DE & EN)." : "Title is required (DE & EN).";
    }
    if (!questionDe.trim() || !questionEn.trim()) {
      return isDe ? "Frage ist Pflicht (DE & EN)." : "Question is required (DE & EN).";
    }
    const n = Number.parseInt(topN, 10);
    if (!Number.isFinite(n) || n < 1 || n > 10) {
      return isDe ? "Top-N zwischen 1 und 10." : "Top-N between 1 and 10.";
    }
    if (mode === "create" && items.length === 0) {
      return isDe ? "Mindestens einen Eintrag hinzufügen." : "Add at least one item.";
    }
    if (items.length > 0 && n > items.length) {
      return dict["upvoteCampaigns_errorTopNTooLarge"] ?? "Top-N cannot exceed number of items.";
    }
    return null;
  }, [titleDe, titleEn, questionDe, questionEn, topN, items, mode, isDe, dict]);

  const handleSubmit = useCallback(async () => {
    const error = validate();
    if (error) {
      toast({ type: "error", title: error });
      return;
    }
    setSubmitting(true);
    try {
      const payload =
        mode === "edit" && status === "active"
          ? {
              description: { de: descDe.trim(), en: descEn.trim() },
              question: { de: questionDe.trim(), en: questionEn.trim() },
              endsAt: endsAt ? new Date(endsAt).toISOString() : null,
            }
          : buildPayload();

      const url =
        mode === "create"
          ? "/api/admin/upvote-campaigns"
          : `/api/admin/upvote-campaigns/${initialCampaign!._id}`;
      const method = mode === "create" ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({
          type: "error",
          title: data?.error ?? dict["upvoteCampaigns_errorGeneric"] ?? "Failed",
        });
        return;
      }

      const data = await res.json();
      toast({ type: "success", title: dict["upvoteCampaigns_savedToast"] ?? "Saved." });

      if (mode === "create") {
        router.push(`/${lang}/admin/upvote-campaigns/${data._id}`);
      } else if (props.mode === "edit") {
        props.onUpdated(data.campaign);
      }
    } catch {
      toast({ type: "error", title: dict["upvoteCampaigns_errorGeneric"] ?? "Network error" });
    } finally {
      setSubmitting(false);
    }
  }, [
    mode,
    status,
    descDe,
    descEn,
    questionDe,
    questionEn,
    endsAt,
    buildPayload,
    validate,
    toast,
    dict,
    initialCampaign,
    router,
    lang,
    props,
  ]);

  const callAction = useCallback(
    async (
      action: "activate" | "close" | "duplicate" | "delete",
      confirmText: string,
      successMsg: string
    ) => {
      if (mode !== "edit") return;
      if (typeof window !== "undefined" && !window.confirm(confirmText)) return;
      setActionLoading(action);
      try {
        const id = initialCampaign!._id;
        let url = `/api/admin/upvote-campaigns/${id}`;
        let method: "POST" | "DELETE" = "POST";
        if (action === "delete") {
          method = "DELETE";
        } else {
          url = `/api/admin/upvote-campaigns/${id}/${action}`;
        }
        const res = await fetch(url, { method });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          toast({
            type: "error",
            title: data?.error ?? dict["upvoteCampaigns_errorGeneric"] ?? "Failed",
          });
          return;
        }
        toast({ type: "success", title: successMsg });
        if (action === "delete") {
          router.push(`/${lang}/admin/upvote-campaigns`);
        } else if (action === "duplicate") {
          const data = await res.json();
          router.push(`/${lang}/admin/upvote-campaigns/${data._id}`);
        } else {
          const detail = await fetch(`/api/admin/upvote-campaigns/${id}`).then((r) => r.json());
          if (props.mode === "edit") props.onUpdated(detail.campaign);
        }
      } catch {
        toast({ type: "error", title: dict["upvoteCampaigns_errorGeneric"] ?? "Network error" });
      } finally {
        setActionLoading(null);
      }
    },
    [mode, initialCampaign, toast, dict, router, lang, props]
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label={dict["upvoteCampaigns_formTitleDe"] ?? "Title (DE)"}>
          <Input value={titleDe} onChange={(e) => setTitleDe(e.target.value)} />
        </Field>
        <Field label={dict["upvoteCampaigns_formTitleEn"] ?? "Title (EN)"}>
          <Input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} />
        </Field>
        <Field label={dict["upvoteCampaigns_formQuestionDe"] ?? "Question (DE)"}>
          <Input value={questionDe} onChange={(e) => setQuestionDe(e.target.value)} />
        </Field>
        <Field label={dict["upvoteCampaigns_formQuestionEn"] ?? "Question (EN)"}>
          <Input value={questionEn} onChange={(e) => setQuestionEn(e.target.value)} />
        </Field>
        <Field label={dict["upvoteCampaigns_formDescDe"] ?? "Description (DE)"}>
          <textarea
            value={descDe}
            onChange={(e) => setDescDe(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 bg-surface border border-border rounded-md text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </Field>
        <Field label={dict["upvoteCampaigns_formDescEn"] ?? "Description (EN)"}>
          <textarea
            value={descEn}
            onChange={(e) => setDescEn(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 bg-surface border border-border rounded-md text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </Field>
        <Field label={dict["upvoteCampaigns_formTopN"] ?? "Top-N"}>
          <Select
            options={TOPN_OPTIONS}
            value={topN}
            onChange={setTopN}
            size="md"
            disabled={topNLocked}
          />
        </Field>
        <Field label={dict["upvoteCampaigns_formEndsAt"] ?? "Ends at (optional)"}>
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className="w-full px-3 py-2 bg-surface border border-border rounded-md text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </Field>
      </div>

      <div>
        <h3 className="text-sm font-medium text-text-primary mb-3">
          {isDe ? "Einträge" : "Items"}
        </h3>
        <UpvoteCampaignItemPicker
          lang={lang}
          dict={dict}
          items={items}
          onChange={setItems}
          disabled={itemsLocked}
        />
      </div>

      <div className="flex flex-wrap gap-3 pt-4 border-t border-border">
        <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
          {dict["upvoteCampaigns_actionSave"] ?? "Save"}
        </Button>

        {mode === "edit" && status === "draft" && (
          <>
            <Button
              variant="accent"
              onClick={() =>
                callAction(
                  "activate",
                  dict["upvoteCampaigns_confirmActivate"] ??
                    "Activate? Items and Top-N cannot be changed afterwards.",
                  dict["upvoteCampaigns_activatedToast"] ?? "Activated."
                )
              }
              disabled={actionLoading !== null || items.length < Number.parseInt(topN, 10)}
            >
              {dict["upvoteCampaigns_actionActivate"] ?? "Activate"}
            </Button>
            <Button
              variant="danger"
              onClick={() =>
                callAction(
                  "delete",
                  dict["upvoteCampaigns_confirmDelete"] ?? "Delete this campaign?",
                  dict["upvoteCampaigns_deletedToast"] ?? "Deleted."
                )
              }
              disabled={actionLoading !== null}
            >
              {dict["upvoteCampaigns_actionDelete"] ?? "Delete"}
            </Button>
          </>
        )}

        {mode === "edit" && status === "active" && (
          <Button
            variant="secondary"
            onClick={() =>
              callAction(
                "close",
                dict["upvoteCampaigns_confirmClose"] ?? "Close? Cannot be reopened.",
                dict["upvoteCampaigns_closedToast"] ?? "Closed."
              )
            }
            disabled={actionLoading !== null}
          >
            {dict["upvoteCampaigns_actionClose"] ?? "Close"}
          </Button>
        )}

        {mode === "edit" && (
          <Button
            variant="ghost"
            onClick={() =>
              callAction(
                "duplicate",
                isDe ? "Als neue Vorlage duplizieren?" : "Duplicate as new template?",
                dict["upvoteCampaigns_duplicatedToast"] ?? "Duplicated."
              )
            }
            disabled={actionLoading !== null}
          >
            {dict["upvoteCampaigns_actionDuplicate"] ?? "Duplicate"}
          </Button>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-text-secondary block mb-1">{label}</span>
      {children}
    </label>
  );
}
