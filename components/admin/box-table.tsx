"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { SelectOption } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import type { JustTCGGame } from "@/lib/justtcg";

interface AdminBox {
  _id: string;
  name: { de: string; en: string };
  game: string;
  status: "draft" | "published" | "paused" | "archived";
  priceInCoins: number;
  cardsCount: number;
  packsOpened: number;
  createdAt: string;
}

interface ApiResponse {
  boxes: AdminBox[];
  total: number;
  page: number;
  totalPages: number;
}

interface BoxTableProps {
  lang: string;
  dict: Record<string, string>;
}

const STATUS_OPTIONS: SelectOption[] = [
  { label: "All statuses", value: "" },
  { label: "Draft", value: "draft" },
  { label: "Published", value: "published" },
  { label: "Paused", value: "paused" },
  { label: "Archived", value: "archived" },
];

function statusBadgeVariant(status: string) {
  if (status === "published") return "success" as const;
  if (status === "draft") return "warning" as const;
  if (status === "paused") return "info" as const;
  return "user" as const;
}

function formatDate(dateStr: string) {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString();
  } catch {
    return "—";
  }
}

export function BoxTable({ lang, dict }: BoxTableProps) {
  void dict;
  const isDe = lang === "de";
  const router = useRouter();
  const { toast } = useToast();

  const [boxes, setBoxes] = useState<AdminBox[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [gameFilter, setGameFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [games, setGames] = useState<JustTCGGame[]>([]);

  useEffect(() => {
    fetch("/api/justtcg/games")
      .then((r) => r.json())
      .then((data: { games?: JustTCGGame[] }) => {
        if (Array.isArray(data.games)) setGames(data.games);
      })
      .catch(() => {/* silently ignore */});
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchBoxes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "20");
      if (search) params.set("search", search);
      if (gameFilter) params.set("game", gameFilter);
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/admin/boxes?${params.toString()}`);
      if (!res.ok) {
        toast({ type: "error", title: "Failed to load boxes" });
        return;
      }
      const data: ApiResponse = await res.json();
      setBoxes(data.boxes);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch {
      toast({ type: "error", title: "Network error" });
    } finally {
      setLoading(false);
    }
  }, [page, search, gameFilter, statusFilter, toast]);

  useEffect(() => {
    void fetchBoxes();
  }, [fetchBoxes]);

  const gameOptions: SelectOption[] = [
    { label: "All games", value: "" },
    ...games.map((g): SelectOption => ({ label: g.name, value: g.id })),
  ];

  return (
    <div className="space-y-4">
      {/* Filters + Create button */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-start sm:items-center">
        <div className="w-full sm:flex-1 sm:min-w-[200px]">
          <Input
            placeholder={isDe ? "Nach Name suchen…" : "Search by name…"}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="py-2 text-sm"
          />
        </div>

        <div className="flex gap-3 flex-wrap">
          <Select
            options={gameOptions}
            value={gameFilter}
            onChange={(val) => { setGameFilter(val); setPage(1); }}
            size="md"
            className="w-44"
          />
          <Select
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(val) => { setStatusFilter(val); setPage(1); }}
            size="md"
            className="w-40"
          />
          <Button
            variant="primary"
            size="md"
            onClick={() => router.push(`/${lang}/admin/boxes/new`)}
          >
            {isDe ? "Box erstellen" : "Create Box"}
          </Button>
        </div>
      </div>

      {/* Count */}
      <p className="text-xs text-text-muted">
        {total} box{total !== 1 ? "es" : ""} found
      </p>

      {/* Table */}
      <div className="w-full overflow-x-auto bg-surface rounded-[14px] border border-border">
        <table className="w-full min-w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                {isDe ? "Name" : "Name"}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                {isDe ? "Spiel" : "Game"}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                {isDe ? "Status" : "Status"}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                {isDe ? "Preis (Coins)" : "Price (Coins)"}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                {isDe ? "Karten" : "Cards"}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                {isDe ? "Packs geöffnet" : "Packs Opened"}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                {isDe ? "Erstellt" : "Created"}
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-text-muted text-sm">
                  {isDe ? "Laden…" : "Loading…"}
                </td>
              </tr>
            ) : boxes.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-text-muted text-sm">
                  {isDe ? "Keine Boxen gefunden." : "No boxes found."}
                </td>
              </tr>
            ) : (
              boxes.map((box) => (
                <tr
                  key={box._id}
                  className="border-b border-border last:border-0 hover:bg-white/2 cursor-pointer transition-colors"
                  onClick={() => router.push(`/${lang}/admin/boxes/${box._id}`)}
                >
                  <td className="px-4 py-3 text-sm text-text-primary font-medium">
                    {isDe ? (box.name.de || box.name.en) : (box.name.en || box.name.de)}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-secondary">
                    <Badge variant="info">{box.game}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusBadgeVariant(box.status)}>
                      {box.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-text-secondary">
                    {box.priceInCoins.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-secondary">
                    {box.cardsCount}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-secondary">
                    {box.packsOpened.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-muted">
                    {formatDate(box.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center pt-2">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={(p) => setPage(p)}
          />
        </div>
      )}
    </div>
  );
}
