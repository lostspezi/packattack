"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { SelectOption } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { JustTCGCardSearch, type AddCardPayload } from "@/components/admin/justtcg-card-search";
import type { JustTCGGame } from "@/lib/justtcg";

export interface PickerCard {
  source: "internal" | "justtcg";
  internalCardId?: string;
  justTcgId?: string;
  name: string;
  game: string;
  set: string;
  setName: string;
  rarity: string;
  image: string | null;
  tcgplayerId: string | null;
}

interface PoolCard {
  _id: string;
  justTcgId: string;
  name: string;
  game: string;
  set: string;
  setName: string;
  rarity: string;
  image: string | null;
  tcgplayerId: string | null;
}

interface Props {
  lang: string;
  dict: Record<string, string>;
  cards: PickerCard[];
  onChange: (cards: PickerCard[]) => void;
  disabled?: boolean;
}

export function UpvoteCampaignCardPicker({
  lang,
  dict,
  cards,
  onChange,
  disabled,
}: Props) {
  const isDe = lang === "de";
  const { toast } = useToast();
  const [tab, setTab] = useState<"pool" | "justtcg">("pool");
  const [games, setGames] = useState<JustTCGGame[]>([]);
  const [game, setGame] = useState("");

  useEffect(() => {
    fetch("/api/justtcg/games")
      .then((r) => r.json())
      .then((data: { games?: JustTCGGame[] }) => {
        if (Array.isArray(data.games)) setGames(data.games);
      })
      .catch(() => {});
  }, []);

  const existingInternalIds = useMemo(
    () => cards.filter((c) => c.source === "internal").map((c) => c.internalCardId ?? ""),
    [cards]
  );
  const existingJustTcgIds = useMemo(
    () => cards.filter((c) => c.source === "justtcg").map((c) => c.justTcgId ?? ""),
    [cards]
  );
  const existingForJustTCG = useMemo(
    () => existingJustTcgIds.filter(Boolean),
    [existingJustTcgIds]
  );

  const addInternal = useCallback(
    (pc: PoolCard) => {
      if (existingInternalIds.includes(pc._id)) {
        toast({ type: "info", title: isDe ? "Karte schon enthalten" : "Card already added" });
        return;
      }
      onChange([
        ...cards,
        {
          source: "internal",
          internalCardId: pc._id,
          justTcgId: pc.justTcgId,
          name: pc.name,
          game: pc.game,
          set: pc.set,
          setName: pc.setName,
          rarity: pc.rarity,
          image: pc.image,
          tcgplayerId: pc.tcgplayerId,
        },
      ]);
    },
    [cards, existingInternalIds, isDe, onChange, toast]
  );

  const addJustTcg = useCallback(
    (payload: AddCardPayload) => {
      if (existingJustTcgIds.includes(payload.justTcgId)) {
        toast({ type: "info", title: isDe ? "Karte schon enthalten" : "Card already added" });
        return;
      }
      onChange([
        ...cards,
        {
          source: "justtcg",
          justTcgId: payload.justTcgId,
          name: payload.name,
          game: payload.game,
          set: payload.set,
          setName: payload.setName,
          rarity: payload.rarity,
          image: null,
          tcgplayerId: payload.tcgplayerId,
        },
      ]);
    },
    [cards, existingJustTcgIds, isDe, onChange, toast]
  );

  const removeAt = useCallback(
    (idx: number) => {
      onChange(cards.filter((_, i) => i !== idx));
    },
    [cards, onChange]
  );

  const move = useCallback(
    (idx: number, dir: -1 | 1) => {
      const next = [...cards];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return;
      [next[idx], next[target]] = [next[target], next[idx]];
      onChange(next);
    },
    [cards, onChange]
  );

  const gameOptions: SelectOption[] = [
    { label: isDe ? "Alle Spiele" : "All games", value: "" },
    ...games.map((g) => ({ label: g.name, value: g.id })),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1 bg-surface-2 rounded-lg p-1 border border-border">
          <button
            type="button"
            onClick={() => setTab("pool")}
            disabled={disabled}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              tab === "pool"
                ? "bg-primary text-on-primary"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {dict["upvoteCampaigns_pickerTabPool"] ?? "From pool"}
          </button>
          <button
            type="button"
            onClick={() => setTab("justtcg")}
            disabled={disabled}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              tab === "justtcg"
                ? "bg-primary text-on-primary"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {dict["upvoteCampaigns_pickerTabExternal"] ?? "Via JustTCG"}
          </button>
        </div>

        {tab === "justtcg" && (
          <Select
            options={gameOptions.filter((o) => o.value !== "")}
            value={game}
            onChange={setGame}
            size="md"
            className="w-56"
            disabled={disabled}
          />
        )}
      </div>

      {!disabled && tab === "pool" && (
        <PoolPicker
          lang={lang}
          dict={dict}
          gameFilter={game}
          gameOptions={gameOptions}
          onGameChange={setGame}
          onPick={addInternal}
        />
      )}

      {!disabled && tab === "justtcg" && game && (
        <JustTCGCardSearch
          game={game}
          existingCardIds={existingForJustTCG}
          onAddCard={addJustTcg}
          lang={lang}
        />
      )}
      {!disabled && tab === "justtcg" && !game && (
        <p className="text-sm text-text-muted">
          {isDe ? "Bitte Spiel wählen." : "Please pick a game."}
        </p>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-text-primary">
          {isDe ? "Karten in der Kampagne" : "Cards in this campaign"} ({cards.length})
        </h3>
        {cards.length === 0 ? (
          <p className="text-sm text-text-muted">
            {dict["upvoteCampaigns_pickerEmpty"] ?? "No cards in this campaign."}
          </p>
        ) : (
          <ul className="space-y-2">
            {cards.map((card, idx) => (
              <li
                key={`${card.source}:${card.internalCardId ?? card.justTcgId}:${idx}`}
                className="flex items-center gap-3 p-3 bg-surface rounded-lg border border-border"
              >
                <span className="text-xs text-text-muted w-6 text-right">{idx + 1}</span>
                {card.image ? (
                  <img
                    src={card.image}
                    alt=""
                    className="w-10 h-14 object-cover rounded bg-surface-2"
                  />
                ) : (
                  <div className="w-10 h-14 bg-surface-2 rounded flex items-center justify-center text-xs text-text-muted">
                    ?
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text-primary truncate">
                    {card.name}
                  </div>
                  <div className="text-xs text-text-muted truncate">
                    {card.setName} · <Badge variant="info">{card.rarity}</Badge>{" "}
                    <Badge variant={card.source === "internal" ? "success" : "warning"}>
                      {card.source === "internal"
                        ? isDe
                          ? "Pool"
                          : "Pool"
                        : "JustTCG"}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => move(idx, -1)}
                    disabled={disabled || idx === 0}
                    title={dict["upvoteCampaigns_pickerMoveUp"] ?? "Move up"}
                    className="p-1.5 rounded hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(idx, 1)}
                    disabled={disabled || idx === cards.length - 1}
                    title={dict["upvoteCampaigns_pickerMoveDown"] ?? "Move down"}
                    className="p-1.5 rounded hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeAt(idx)}
                    disabled={disabled}
                    title={dict["upvoteCampaigns_pickerRemove"] ?? "Remove"}
                    className="p-1.5 rounded hover:bg-surface-2 text-red-400 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

interface PoolPickerProps {
  lang: string;
  dict: Record<string, string>;
  gameFilter: string;
  gameOptions: SelectOption[];
  onGameChange: (val: string) => void;
  onPick: (card: PoolCard) => void;
}

function PoolPicker({ lang, dict, gameFilter, gameOptions, onGameChange, onPick }: PoolPickerProps) {
  const isDe = lang === "de";
  const [q, setQ] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [results, setResults] = useState<PoolCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      p.set("page", String(page));
      p.set("limit", "12");
      if (q) p.set("q", q);
      if (gameFilter) p.set("game", gameFilter);
      const res = await fetch(`/api/admin/cards?${p.toString()}`);
      if (!res.ok) return;
      const data: { cards: PoolCard[]; totalPages: number } = await res.json();
      setResults(data.cards);
      setTotalPages(data.totalPages);
    } finally {
      setLoading(false);
    }
  }, [page, q, gameFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-3 p-4 bg-surface-2 rounded-lg border border-border">
      <div className="flex flex-wrap gap-2">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <Input
            placeholder={dict["upvoteCampaigns_pickerSearchPlaceholder"] ?? "Search card..."}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9 py-2 text-sm"
          />
        </div>
        <Select
          options={gameOptions}
          value={gameFilter}
          onChange={onGameChange}
          size="md"
          className="w-44"
        />
      </div>

      {loading ? (
        <p className="text-xs text-text-muted">{isDe ? "Lädt..." : "Loading..."}</p>
      ) : results.length === 0 ? (
        <p className="text-xs text-text-muted">
          {isDe ? "Keine Karten gefunden." : "No cards found."}
        </p>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {results.map((c) => (
            <li
              key={c._id}
              className="flex items-center gap-2 p-2 bg-surface rounded border border-border"
            >
              {c.image ? (
                <img src={c.image} alt="" className="w-8 h-11 object-cover rounded" />
              ) : (
                <div className="w-8 h-11 bg-surface-2 rounded" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-text-primary truncate">{c.name}</div>
                <div className="text-[11px] text-text-muted truncate">
                  {c.setName} · {c.rarity}
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => onPick(c)}>
                {dict["upvoteCampaigns_pickerAdd"] ?? "Add"}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="flex justify-between items-center text-xs">
          <Button
            size="sm"
            variant="ghost"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ←
          </Button>
          <span className="text-text-muted">
            {page} / {totalPages}
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            →
          </Button>
        </div>
      )}
    </div>
  );
}
