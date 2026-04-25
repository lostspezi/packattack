"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import type { SelectOption } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";

interface AdminUpvoteCampaignRow {
  _id: string;
  title: { de: string; en: string };
  status: "draft" | "active" | "closed";
  topN: number;
  itemCount: number;
  voteCount: number;
  endsAt: string | null;
  closedAt: string | null;
  createdAt: string;
}

interface ApiResponse {
  campaigns: AdminUpvoteCampaignRow[];
  total: number;
  page: number;
  totalPages: number;
}

interface Props {
  lang: string;
  dict: Record<string, string>;
}

function statusBadgeVariant(status: string) {
  if (status === "active") return "success" as const;
  if (status === "draft") return "warning" as const;
  return "user" as const;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString();
  } catch {
    return "—";
  }
}

export function UpvoteCampaignTable({ lang, dict }: Props) {
  const isDe = lang === "de";
  const router = useRouter();
  const { toast } = useToast();

  const [rows, setRows] = useState<AdminUpvoteCampaignRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      p.set("page", String(page));
      p.set("limit", "20");
      if (search) p.set("search", search);
      if (statusFilter) p.set("status", statusFilter);
      const res = await fetch(`/api/admin/upvote-campaigns?${p.toString()}`);
      if (!res.ok) {
        toast({ type: "error", title: dict["upvoteCampaigns_errorGeneric"] ?? "Failed to load" });
        return;
      }
      const data: ApiResponse = await res.json();
      setRows(data.campaigns);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch {
      toast({ type: "error", title: dict["upvoteCampaigns_errorGeneric"] ?? "Network error" });
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, dict, toast]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const statusOptions: SelectOption[] = [
    { label: dict["upvoteCampaigns_statusAll"] ?? "All statuses", value: "" },
    { label: dict["upvoteCampaigns_statusDraft"] ?? "Draft", value: "draft" },
    { label: dict["upvoteCampaigns_statusActive"] ?? "Active", value: "active" },
    { label: dict["upvoteCampaigns_statusClosed"] ?? "Closed", value: "closed" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-start sm:items-center">
        <div className="w-full sm:flex-1 sm:min-w-[200px]">
          <Input
            placeholder={dict["upvoteCampaigns_searchPlaceholder"] ?? "Search by title..."}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="py-2 text-sm"
          />
        </div>
        <div className="flex gap-3 flex-wrap">
          <Select
            options={statusOptions}
            value={statusFilter}
            onChange={(val) => {
              setStatusFilter(val);
              setPage(1);
            }}
            size="md"
            className="w-44"
          />
          <Button
            variant="primary"
            size="md"
            onClick={() => router.push(`/${lang}/admin/upvote-campaigns/new`)}
          >
            {dict["upvoteCampaigns_create"] ?? "Create campaign"}
          </Button>
        </div>
      </div>

      <p className="text-xs text-text-muted">
        {total} {total === 1 ? (isDe ? "Kampagne" : "campaign") : isDe ? "Kampagnen" : "campaigns"}
      </p>

      <div className="w-full overflow-x-auto bg-surface rounded-[14px] border border-border">
        <table className="w-full min-w-full">
          <thead>
            <tr className="border-b border-border">
              <Th>{dict["upvoteCampaigns_colTitle"] ?? "Title"}</Th>
              <Th>{dict["upvoteCampaigns_colStatus"] ?? "Status"}</Th>
              <Th>{dict["upvoteCampaigns_colTopN"] ?? "Top-N"}</Th>
              <Th>{dict["upvoteCampaigns_colItems"] ?? "Items"}</Th>
              <Th>{dict["upvoteCampaigns_colVotes"] ?? "Votes"}</Th>
              <Th>{dict["upvoteCampaigns_colEndsAt"] ?? "Ends"}</Th>
              <Th>{dict["upvoteCampaigns_colCreated"] ?? "Created"}</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-text-muted text-sm">
                  {isDe ? "Lädt..." : "Loading..."}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-text-muted text-sm">
                  {dict["upvoteCampaigns_emptyList"] ?? "No campaigns yet."}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row._id}
                  className="border-b border-border last:border-0 hover:bg-white/2 cursor-pointer transition-colors"
                  onClick={() => router.push(`/${lang}/admin/upvote-campaigns/${row._id}`)}
                >
                  <td className="px-4 py-3 text-sm text-text-primary font-medium">
                    {isDe ? row.title.de || row.title.en : row.title.en || row.title.de}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusBadgeVariant(row.status)}>
                      {dict[`upvoteCampaigns_status${row.status.charAt(0).toUpperCase()}${row.status.slice(1)}`] ?? row.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-text-secondary">{row.topN}</td>
                  <td className="px-4 py-3 text-sm text-text-secondary">{row.itemCount}</td>
                  <td className="px-4 py-3 text-sm text-text-secondary">{row.voteCount}</td>
                  <td className="px-4 py-3 text-sm text-text-muted">{formatDate(row.endsAt)}</td>
                  <td className="px-4 py-3 text-sm text-text-muted">{formatDate(row.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center pt-2">
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={(p) => setPage(p)} />
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
      {children}
    </th>
  );
}
