"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

interface ResultsResponse {
  totalVoters: number;
  perItem: Array<{
    itemRefId: string;
    voteCount: number;
    item: {
      kind: "card" | "option" | "box";
      label: { de: string; en: string };
      image: string | null;
      rarity: string | null;
      game: string | null;
      set: string | null;
      setName: string | null;
      source: "internal" | "justtcg" | null;
      boxSlug: string | null;
    } | null;
    voters: Array<{ userId: string; name: string; username: string; votedAt: string }>;
  }>;
}

interface Props {
  lang: string;
  dict: Record<string, string>;
  campaignId: string;
}

export function UpvoteCampaignResults({ lang, dict, campaignId }: Props) {
  const isDe = lang === "de";
  const { toast } = useToast();
  const [data, setData] = useState<ResultsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [openItem, setOpenItem] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/upvote-campaigns/${campaignId}/results`);
      if (!res.ok) {
        toast({ type: "error", title: dict["upvoteCampaigns_errorGeneric"] ?? "Failed" });
        return;
      }
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [campaignId, dict, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading || !data) {
    return <p className="text-sm text-text-muted">{isDe ? "Lädt..." : "Loading..."}</p>;
  }

  const totalText = (dict["upvoteCampaigns_resultsTotalVoters"] ?? "{{count}} people voted").replace(
    "{{count}}",
    String(data.totalVoters)
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">{totalText}</p>
        <div className="flex gap-2">
          <a
            href={`/api/admin/upvote-campaigns/${campaignId}/export?format=csv-long`}
            download
          >
            <Button variant="ghost" size="sm">
              <Download className="w-4 h-4 mr-1" />
              {dict["upvoteCampaigns_resultsExportCsvLong"] ?? "CSV (long)"}
            </Button>
          </a>
          <a
            href={`/api/admin/upvote-campaigns/${campaignId}/export?format=csv-matrix`}
            download
          >
            <Button variant="ghost" size="sm">
              <Download className="w-4 h-4 mr-1" />
              {dict["upvoteCampaigns_resultsExportCsvMatrix"] ?? "CSV (matrix)"}
            </Button>
          </a>
        </div>
      </div>

      {data.perItem.length === 0 ? (
        <p className="text-sm text-text-muted">
          {dict["upvoteCampaigns_resultsNoVotes"] ?? "No votes yet."}
        </p>
      ) : (
        <ul className="space-y-2">
          {data.perItem.map((row, idx) => {
            const isOpen = openItem === row.itemRefId;
            const label = row.item
              ? isDe
                ? row.item.label.de || row.item.label.en
                : row.item.label.en || row.item.label.de
              : row.itemRefId;
            return (
              <li key={row.itemRefId} className="bg-surface rounded-lg border border-border">
                <button
                  type="button"
                  onClick={() => setOpenItem(isOpen ? null : row.itemRefId)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-white/2 text-left"
                >
                  <span className="text-sm font-bold text-text-muted w-6 text-right">
                    {idx + 1}
                  </span>
                  {row.item?.image ? (
                    <img
                      src={row.item.image}
                      alt=""
                      className="w-10 h-14 object-cover rounded bg-surface-2"
                    />
                  ) : (
                    <div className="w-10 h-14 bg-surface-2 rounded flex items-center justify-center text-text-muted">
                      {row.item?.kind === "box" ? <Package className="w-4 h-4" /> : null}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text-primary truncate">{label}</div>
                    <div className="text-xs text-text-muted truncate flex items-center gap-1">
                      {row.item?.kind === "card" && row.item.setName && (
                        <>
                          {row.item.setName}
                          {row.item.rarity && <Badge variant="info">{row.item.rarity}</Badge>}
                        </>
                      )}
                      {row.item?.kind === "box" && (
                        <>
                          <Package className="w-3 h-3" />
                          {row.item.game ?? "Box"}
                        </>
                      )}
                      {row.item?.kind === "option" && (
                        <Badge variant="warning">{isDe ? "Option" : "Option"}</Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-sm font-bold text-text-primary tabular-nums">
                    {row.voteCount}
                  </div>
                </button>
                {isOpen && (
                  <div className="px-3 pb-3 pt-0 border-t border-border">
                    <h4 className="text-xs uppercase text-text-muted mt-3 mb-2">
                      {dict["upvoteCampaigns_resultsVoterListTitle"] ?? "Who picked this?"}
                    </h4>
                    {row.voters.length === 0 ? (
                      <p className="text-xs text-text-muted">
                        {dict["upvoteCampaigns_resultsNoVotes"] ?? "No votes yet."}
                      </p>
                    ) : (
                      <ul className="space-y-1 max-h-60 overflow-y-auto">
                        {row.voters.map((v) => (
                          <li
                            key={`${v.userId}-${row.itemRefId}`}
                            className="flex justify-between text-xs"
                          >
                            <span className="text-text-primary">
                              {v.name} <span className="text-text-muted">@{v.username}</span>
                            </span>
                            <span className="text-text-muted">
                              {new Date(v.votedAt).toLocaleString()}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
