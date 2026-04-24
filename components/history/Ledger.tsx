"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface HistoryRow {
  id: string;
  createdAt: string;
  packGroupId: string;
  packIndex: number;
  cardIndex: number;
  status: string;
  rarity: string;
  coinValue: number;
  conversionValue: number;
  card: { id: string; name: string; image: string | null };
  box: { id: string; name: { de?: string; en?: string } | null; slug: string | null };
  fairness: { commitmentId: string; nonce: number | null } | null;
}

interface LedgerProps {
  lang: string;
}

function formatDay(iso: string, lang: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(lang === "de" ? "de-DE" : "en-US", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatTime(iso: string, lang: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(lang === "de" ? "de-DE" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Offen",
  reserved: "Claimed",
  converted: "Converted",
  claimed: "Claimed",
};

export default function Ledger({ lang }: LedgerProps) {
  const [items, setItems] = useState<HistoryRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // boxFilter: reserved for a future box-picker. Left ungated so the URL
  // param still works if someone arrives with ?box=<id>.
  const [boxFilter] = useState("");
  const [rarityFilter, setRarityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [query, setQuery] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");

  const sentinelRef = useRef<HTMLDivElement>(null);
  // A monotonically-increasing id stamped on every loadPage call. The async
  // resolver checks that its id still matches requestIdRef.current before
  // applying state, so in-flight fetches from an old filter are dropped.
  const requestIdRef = useRef(0);

  const loadPage = useCallback(
    async (reset: boolean, cursorValue: string | null) => {
      const myId = ++requestIdRef.current;
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        if (!reset && cursorValue) qs.set("cursor", cursorValue);
        if (boxFilter) qs.set("box", boxFilter);
        if (rarityFilter) qs.set("rarity", rarityFilter);
        if (statusFilter) qs.set("status", statusFilter);
        if (searchDebounced) qs.set("q", searchDebounced);

        const res = await fetch(`/api/account/history?${qs.toString()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "fetch failed");

        // Abort if another request superseded us while this one was in flight.
        if (requestIdRef.current !== myId) return;

        setItems((prev) => (reset ? data.items : [...prev, ...data.items]));
        setCursor(data.nextCursor);
        setHasMore(!!data.nextCursor);
      } catch (err) {
        if (requestIdRef.current !== myId) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (requestIdRef.current === myId) setLoading(false);
      }
    },
    [boxFilter, rarityFilter, statusFilter, searchDebounced],
  );

  // Debounce search input so every keystroke doesn't hit the API.
  useEffect(() => {
    const handle = setTimeout(() => setSearchDebounced(query), 300);
    return () => clearTimeout(handle);
  }, [query]);

  // Reset and reload whenever a filter changes. hasMore goes false during
  // the reset window so the IntersectionObserver can't kick off a second
  // "next page" fetch before the reset response lands.
  useEffect(() => {
    setItems([]);
    setCursor(null);
    setHasMore(false);
    loadPage(true, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boxFilter, rarityFilter, statusFilter, searchDebounced]);

  // IntersectionObserver drives infinite scroll. The sentinel sits after the
  // last row; when it enters the viewport we load the next page using the
  // current cursor value (closure-captured at effect run time).
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && hasMore && !loading && cursor) {
            loadPage(false, cursor);
          }
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, loadPage, cursor]);

  // Group rows by day so the ledger reads like a chronological wallet.
  const dayGroups: Array<{ day: string; rows: HistoryRow[] }> = [];
  for (const r of items) {
    const day = formatDay(r.createdAt, lang);
    const last = dayGroups[dayGroups.length - 1];
    if (last && last.day === day) {
      last.rows.push(r);
    } else {
      dayGroups.push({ day, rows: [r] });
    }
  }

  function handleExport() {
    const qs = new URLSearchParams();
    if (boxFilter) qs.set("box", boxFilter);
    if (rarityFilter) qs.set("rarity", rarityFilter);
    if (statusFilter) qs.set("status", statusFilter);
    if (searchDebounced) qs.set("q", searchDebounced);
    window.location.href = `/api/account/history/export.csv?${qs.toString()}`;
  }

  return (
    <div className="flex flex-col gap-4">
      <Card variant="soft" className="p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-text-secondary">Suche (Kartenname)</label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-white/3 border border-white/8 rounded-[10px] px-3 py-2 text-sm"
              placeholder="z.B. Charizard"
            />
          </div>
          <div>
            <label className="text-xs text-text-secondary">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white/3 border border-white/8 rounded-[10px] px-3 py-2 text-sm"
            >
              <option value="">alle</option>
              <option value="pending">Offen</option>
              <option value="reserved">Claimed</option>
              <option value="converted">Converted</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-text-secondary">Rarity</label>
            <input
              type="text"
              value={rarityFilter}
              onChange={(e) => setRarityFilter(e.target.value)}
              className="bg-white/3 border border-white/8 rounded-[10px] px-3 py-2 text-sm w-32"
              placeholder="z.B. Common"
            />
          </div>
          <Button variant="secondary" size="sm" onClick={handleExport}>
            Als CSV
          </Button>
        </div>
      </Card>

      {dayGroups.length === 0 && !loading && (
        <Card variant="soft" className="p-8 text-center text-text-secondary">
          Noch keine Pulls.
        </Card>
      )}

      {dayGroups.map((group) => (
        <div key={group.day}>
          <h3 className="text-sm text-text-secondary font-semibold mb-2 mt-2">{group.day}</h3>
          <Card variant="soft" className="p-0 overflow-hidden">
            {group.rows.map((r, i) => (
              <Row key={r.id} row={r} lang={lang} isLast={i === group.rows.length - 1} />
            ))}
          </Card>
        </div>
      ))}

      <div ref={sentinelRef} className="h-8 flex items-center justify-center text-text-secondary text-sm">
        {loading && <span>Lade…</span>}
        {!loading && !hasMore && items.length > 0 && <span>Das war alles.</span>}
      </div>
      {error && <p className="text-error-light text-sm">{error}</p>}
    </div>
  );
}

function Row({ row, lang, isLast }: { row: HistoryRow; lang: string; isLast: boolean }) {
  const boxName = row.box.name?.de ?? row.box.name?.en ?? "";
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 ${isLast ? "" : "border-b border-white/5"}`}
    >
      <span className="text-xs text-text-secondary font-mono w-20">
        {formatTime(row.createdAt, lang)}
      </span>
      {row.card.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={row.card.image}
          alt={row.card.name}
          className="w-10 h-14 object-cover rounded-[4px]"
          loading="lazy"
        />
      ) : (
        <div className="w-10 h-14 bg-white/5 rounded-[4px]" />
      )}
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{row.card.name}</div>
        <div className="text-xs text-text-secondary truncate">
          {boxName} · Pack {row.packIndex + 1} · Karte {row.cardIndex + 1}
        </div>
      </div>
      <span className="text-xs bg-white/5 rounded-[6px] px-2 py-0.5">{row.rarity}</span>
      <span className="font-mono text-sm whitespace-nowrap">{row.coinValue} c</span>
      <span className="text-xs text-text-secondary whitespace-nowrap w-20 text-right">
        {STATUS_LABEL[row.status] ?? row.status}
      </span>
      {row.fairness ? (
        <Link
          href={`/${lang}/provably-fair/verify?commitmentId=${row.fairness.commitmentId}`}
          className="text-pa-green text-xs whitespace-nowrap"
        >
          Verify
        </Link>
      ) : (
        <span className="text-text-secondary/50 text-xs whitespace-nowrap">Pre-PF</span>
      )}
    </div>
  );
}
