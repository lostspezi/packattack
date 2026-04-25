"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { UpvoteCampaignForm } from "@/components/admin/upvote-campaign-form";
import { UpvoteCampaignResults } from "@/components/admin/upvote-campaign-results";

interface CampaignDoc {
  _id: string;
  title: { de: string; en: string };
  description: { de: string; en: string };
  question: { de: string; en: string };
  status: "draft" | "active" | "closed";
  topN: number;
  cards: Array<{
    _id: string;
    source: "internal" | "justtcg";
    internalCardId: string | null;
    justTcgId: string | null;
    name: string;
    game: string;
    set: string;
    setName: string;
    rarity: string;
    image: string | null;
    tcgplayerId: string | null;
    position: number;
  }>;
  endsAt: string | null;
  closedAt: string | null;
}

interface Props {
  lang: string;
  dict: Record<string, string>;
  id: string;
}

function statusBadgeVariant(status: string) {
  if (status === "active") return "success" as const;
  if (status === "draft") return "warning" as const;
  return "user" as const;
}

export function UpvoteCampaignDetail({ lang, dict, id }: Props) {
  const isDe = lang === "de";
  const router = useRouter();
  const { toast } = useToast();
  const [campaign, setCampaign] = useState<CampaignDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"edit" | "results">("edit");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/upvote-campaigns/${id}`);
      if (!res.ok) {
        if (res.status === 404) {
          toast({
            type: "error",
            title: isDe ? "Kampagne nicht gefunden" : "Campaign not found",
          });
          router.push(`/${lang}/admin/upvote-campaigns`);
          return;
        }
        toast({ type: "error", title: dict["upvoteCampaigns_errorGeneric"] ?? "Failed" });
        return;
      }
      const data = await res.json();
      setCampaign(data.campaign);
    } finally {
      setLoading(false);
    }
  }, [id, dict, toast, router, lang, isDe]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading || !campaign) {
    return (
      <div className="space-y-4 md:space-y-6">
        <p className="text-sm text-text-muted">{isDe ? "Lädt..." : "Loading..."}</p>
      </div>
    );
  }

  const title = isDe ? campaign.title.de || campaign.title.en : campaign.title.en || campaign.title.de;

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-bold text-text-primary">{title}</h2>
        <Badge variant={statusBadgeVariant(campaign.status)}>
          {dict[`upvoteCampaigns_status${campaign.status.charAt(0).toUpperCase()}${campaign.status.slice(1)}`] ?? campaign.status}
        </Badge>
      </div>

      <div className="flex gap-1 bg-surface-2 rounded-lg p-1 border border-border w-fit">
        <button
          type="button"
          onClick={() => setTab("edit")}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            tab === "edit"
              ? "bg-primary text-on-primary"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          {dict["upvoteCampaigns_resultsEditTab"] ?? "Edit"}
        </button>
        <button
          type="button"
          onClick={() => setTab("results")}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            tab === "results"
              ? "bg-primary text-on-primary"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          {dict["upvoteCampaigns_resultsTab"] ?? "Results"}
        </button>
      </div>

      {tab === "edit" ? (
        <UpvoteCampaignForm
          lang={lang}
          dict={dict}
          mode="edit"
          campaign={campaign}
          onUpdated={(c) => setCampaign(c)}
        />
      ) : (
        <UpvoteCampaignResults lang={lang} dict={dict} campaignId={campaign._id} />
      )}
    </div>
  );
}
