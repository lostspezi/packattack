"use client";

import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { SelectOption } from "@/components/ui/select";

interface Pull {
  _id: string;
  user: { name?: string; email?: string; username?: string; image?: string | null } | null;
  card: { name?: string; image?: string | null; rarity?: string } | null;
  rarity: string;
  coinValue: number;
  conversionValue: number;
  status: string;
  decidedAt: string | null;
  ipAddress: string;
  createdAt: string;
}

interface BoxPullHistoryProps {
  boxId: string;
  lang: string;
}

function statusBadge(status: string) {
  if (status === "claimed") return "success" as const;
  if (status === "converted") return "info" as const;
  if (status === "expired") return "error" as const;
  return "warning" as const;
}

function statusLabel(status: string, isDe: boolean) {
  const map: Record<string, { de: string; en: string }> = {
    claimed: { de: "Geclaimed", en: "Claimed" },
    converted: { de: "Umgewandelt", en: "Converted" },
  };
  return isDe ? (map[status]?.de ?? status) : (map[status]?.en ?? status);
}

export function BoxPullHistory({ boxId, lang }: BoxPullHistoryProps) {
  const isDe = lang === "de";

  const [pulls, setPulls] = useState<Pull[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ page: String(page), limit: "30" });
    if (statusFilter) params.set("status", statusFilter);
    fetch(`/api/admin/boxes/${boxId}/pulls?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok || cancelled) return;
        const data = await res.json() as { pulls?: Pull[]; total?: number; totalPages?: number };
        setPulls(data.pulls ?? []);
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 1);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [boxId, page, statusFilter]);

  const statusOptions: SelectOption[] = [
    { label: isDe ? "Alle Status" : "All Status", value: "" },
    { label: isDe ? "Geclaimed" : "Claimed", value: "claimed" },
    { label: isDe ? "Umgewandelt" : "Converted", value: "converted" },
  ];

  return (
    <div className="bg-surface border border-border rounded-[14px] p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-text-primary">
          {isDe ? "Pull-Historie" : "Pull History"}
          <span className="text-text-muted font-normal ml-1.5">({total.toLocaleString()})</span>
        </h3>
        <div className="w-40">
          <Select
            options={statusOptions}
            value={statusFilter}
            onChange={(v) => { setLoading(true); setStatusFilter(v); setPage(1); }}
            size="sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center">
          <Loader2 className="w-5 h-5 animate-spin mx-auto text-pa-green" />
        </div>
      ) : pulls.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-muted">
          {isDe ? "Keine Pulls gefunden." : "No pulls found."}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-2 py-2 text-left text-xs font-medium text-text-secondary uppercase">{isDe ? "Zeitpunkt" : "Time"}</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-text-secondary uppercase">User</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-text-secondary uppercase">IP</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-text-secondary uppercase">{isDe ? "Karte" : "Card"}</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-text-secondary uppercase">Rarity</th>
                  <th className="px-2 py-2 text-right text-xs font-medium text-text-secondary uppercase">Coins</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-text-secondary uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {pulls.map((p) => (
                  <tr key={p._id} className="border-b border-border/30 last:border-0 hover:bg-white/3 transition-colors">
                    <td className="px-2 py-2 text-xs text-text-muted tabular-nums whitespace-nowrap">
                      {new Date(p.createdAt).toLocaleString(isDe ? "de-DE" : "en-US", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="px-2 py-2 text-sm text-text-primary truncate max-w-[120px]">
                      {(p.user as { name?: string })?.name ?? "—"}
                    </td>
                    <td className="px-2 py-2 text-xs text-text-muted font-mono truncate max-w-[100px]">
                      {p.ipAddress || "—"}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        {(p.card as { image?: string | null })?.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={(p.card as { image: string }).image} alt="" className="w-6 rounded shrink-0" loading="lazy" />
                        ) : null}
                        <span className="text-sm text-text-primary truncate max-w-[140px]">
                          {(p.card as { name?: string })?.name ?? "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-2"><Badge variant="info">{p.rarity}</Badge></td>
                    <td className="px-2 py-2 text-sm text-text-primary text-right tabular-nums">{p.coinValue}</td>
                    <td className="px-2 py-2"><Badge variant={statusBadge(p.status)}>{statusLabel(p.status, isDe)}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-text-muted">
                {isDe ? "Seite" : "Page"} {page}/{totalPages}
              </span>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => { setLoading(true); setPage((p) => p - 1); }}>
                  {isDe ? "Zurück" : "Previous"}
                </Button>
                <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => { setLoading(true); setPage((p) => p + 1); }}>
                  {isDe ? "Weiter" : "Next"}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
