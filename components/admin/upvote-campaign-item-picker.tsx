"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { GripVertical, Search, X, Package, Sparkles } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { SelectOption } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { JustTCGCardSearch, type AddCardPayload } from "@/components/admin/justtcg-card-search";
import type { JustTCGGame } from "@/lib/justtcg";

export type ItemKind = "card" | "option" | "box";
export type CardSource = "internal" | "justtcg";

export interface PickerItem {
  kind: ItemKind;
  // generic display
  label: { de: string; en: string };
  description?: { de: string; en: string };
  image: string | null;
  // card-specific
  source?: CardSource;
  internalCardId?: string;
  justTcgId?: string;
  game?: string;
  set?: string;
  setName?: string;
  rarity?: string;
  tcgplayerId?: string | null;
  // box-specific
  boxId?: string;
  boxSlug?: string;
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

interface PoolBox {
  _id: string;
  slug: string;
  name: { de: string; en: string };
  image: string | null;
  game?: string;
}

interface Props {
  lang: string;
  dict: Record<string, string>;
  items: PickerItem[];
  onChange: (items: PickerItem[]) => void;
  disabled?: boolean;
}

function itemDisplayLabel(item: PickerItem, isDe: boolean): string {
  return isDe ? item.label.de || item.label.en : item.label.en || item.label.de;
}

function pickerKey(item: PickerItem, idx: number): string {
  const ref =
    item.kind === "card"
      ? item.internalCardId ?? item.justTcgId ?? item.label.de
      : item.kind === "box"
      ? item.boxId ?? item.label.de
      : item.label.de;
  return `${item.kind}:${ref}#${idx}`;
}

export function UpvoteCampaignItemPicker({
  lang,
  dict,
  items,
  onChange,
  disabled,
}: Props) {
  const isDe = lang === "de";
  const { toast } = useToast();
  const [tab, setTab] = useState<"cards" | "boxes" | "options">("cards");
  const [cardSubTab, setCardSubTab] = useState<"pool" | "justtcg">("pool");
  const [games, setGames] = useState<JustTCGGame[]>([]);
  const [game, setGame] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    fetch("/api/justtcg/games")
      .then((r) => r.json())
      .then((data: { games?: JustTCGGame[] }) => {
        if (Array.isArray(data.games)) setGames(data.games);
      })
      .catch(() => {});
  }, []);

  const existingInternalCardIds = useMemo(
    () =>
      items
        .filter((c) => c.kind === "card" && c.source === "internal")
        .map((c) => c.internalCardId ?? ""),
    [items]
  );
  const existingJustTcgIds = useMemo(
    () =>
      items
        .filter((c) => c.kind === "card" && c.source === "justtcg")
        .map((c) => c.justTcgId ?? "")
        .filter(Boolean),
    [items]
  );
  const existingBoxIds = useMemo(
    () => items.filter((c) => c.kind === "box").map((c) => c.boxId ?? ""),
    [items]
  );

  const itemsWithKeys = useMemo(
    () => items.map((c, idx) => ({ key: pickerKey(c, idx), item: c })),
    [items]
  );
  const sortableIds = useMemo(() => itemsWithKeys.map((c) => c.key), [itemsWithKeys]);

  const addInternalCard = useCallback(
    (pc: PoolCard) => {
      if (existingInternalCardIds.includes(pc._id)) {
        toast({ type: "info", title: isDe ? "Karte schon enthalten" : "Card already added" });
        return;
      }
      onChange([
        ...items,
        {
          kind: "card",
          source: "internal",
          internalCardId: pc._id,
          justTcgId: pc.justTcgId,
          label: { de: pc.name, en: pc.name },
          game: pc.game,
          set: pc.set,
          setName: pc.setName,
          rarity: pc.rarity,
          image: pc.image,
          tcgplayerId: pc.tcgplayerId,
        },
      ]);
    },
    [items, existingInternalCardIds, isDe, onChange, toast]
  );

  const addJustTcgCard = useCallback(
    (payload: AddCardPayload) => {
      if (existingJustTcgIds.includes(payload.justTcgId)) {
        toast({ type: "info", title: isDe ? "Karte schon enthalten" : "Card already added" });
        return;
      }
      onChange([
        ...items,
        {
          kind: "card",
          source: "justtcg",
          justTcgId: payload.justTcgId,
          label: { de: payload.name, en: payload.name },
          game: payload.game,
          set: payload.set,
          setName: payload.setName,
          rarity: payload.rarity,
          image: null,
          tcgplayerId: payload.tcgplayerId,
        },
      ]);
    },
    [items, existingJustTcgIds, isDe, onChange, toast]
  );

  const addBox = useCallback(
    (pb: PoolBox) => {
      if (existingBoxIds.includes(pb._id)) {
        toast({ type: "info", title: isDe ? "Box schon enthalten" : "Box already added" });
        return;
      }
      onChange([
        ...items,
        {
          kind: "box",
          boxId: pb._id,
          boxSlug: pb.slug,
          label: pb.name,
          image: pb.image,
          game: pb.game,
        },
      ]);
    },
    [items, existingBoxIds, isDe, onChange, toast]
  );

  const addOption = useCallback(
    (option: { label: { de: string; en: string }; description?: { de: string; en: string }; image: string | null }) => {
      onChange([...items, { kind: "option", ...option }]);
    },
    [items, onChange]
  );

  const importJustTcgGames = useCallback(() => {
    const existingLabels = new Set(items.map((i) => i.label.de.toLowerCase()));
    const fresh = games.filter((g) => !existingLabels.has(g.name.toLowerCase()));
    if (fresh.length === 0) {
      toast({ type: "info", title: isDe ? "Alle TCGs bereits hinzugefügt" : "All TCGs already added" });
      return;
    }
    const newOptions: PickerItem[] = fresh.map((g) => ({
      kind: "option",
      label: { de: g.name, en: g.name },
      image: null,
    }));
    onChange([...items, ...newOptions]);
    toast({
      type: "success",
      title: (isDe ? "{{n}} TCGs hinzugefügt" : "{{n}} TCGs added").replace("{{n}}", String(newOptions.length)),
    });
  }, [items, games, onChange, toast, isDe]);

  const removeAt = useCallback(
    (idx: number) => {
      onChange(items.filter((_, i) => i !== idx));
    },
    [items, onChange]
  );

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      if (disabled) return;
      const { active, over } = e;
      if (!over || active.id === over.id) return;
      const fromIdx = sortableIds.indexOf(active.id as string);
      const toIdx = sortableIds.indexOf(over.id as string);
      if (fromIdx < 0 || toIdx < 0) return;
      onChange(arrayMove(items, fromIdx, toIdx));
    },
    [items, disabled, onChange, sortableIds]
  );

  const gameOptions: SelectOption[] = [
    { label: isDe ? "Alle Spiele" : "All games", value: "" },
    ...games.map((g) => ({ label: g.name, value: g.id })),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1 bg-surface-2 rounded-lg p-1 border border-border">
          {(["cards", "boxes", "options"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              disabled={disabled}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                tab === t
                  ? "bg-primary text-on-primary"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {dict[`upvoteCampaigns_pickerTab_${t}`] ??
                (t === "cards" ? "Cards" : t === "boxes" ? "Boxes" : "Options")}
            </button>
          ))}
        </div>
      </div>

      {!disabled && tab === "cards" && (
        <div className="space-y-3">
          <div className="flex gap-1 bg-surface-2/50 rounded-lg p-1 border border-border w-fit">
            {(["pool", "justtcg"] as const).map((sub) => (
              <button
                key={sub}
                type="button"
                onClick={() => setCardSubTab(sub)}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  cardSubTab === sub
                    ? "bg-primary/80 text-on-primary"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {sub === "pool"
                  ? dict["upvoteCampaigns_pickerTabPool"] ?? "From pool"
                  : dict["upvoteCampaigns_pickerTabExternal"] ?? "Via JustTCG"}
              </button>
            ))}
          </div>

          {cardSubTab === "pool" ? (
            <PoolCardPicker
              lang={lang}
              dict={dict}
              gameFilter={game}
              gameOptions={gameOptions}
              onGameChange={setGame}
              onPick={addInternalCard}
            />
          ) : (
            <div className="space-y-3 p-4 bg-surface-2 rounded-lg border border-border">
              <Select
                options={gameOptions.filter((o) => o.value !== "")}
                value={game}
                onChange={setGame}
                size="md"
                className="w-56"
              />
              {game ? (
                <JustTCGCardSearch
                  game={game}
                  existingCardIds={existingJustTcgIds}
                  onAddCard={addJustTcgCard}
                  lang={lang}
                />
              ) : (
                <p className="text-sm text-text-muted">
                  {isDe ? "Bitte Spiel wählen." : "Please pick a game."}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {!disabled && tab === "boxes" && (
        <BoxPicker lang={lang} dict={dict} onPick={addBox} />
      )}

      {!disabled && tab === "options" && (
        <OptionPicker
          lang={lang}
          dict={dict}
          onAdd={addOption}
          onImportTcgs={importJustTcgGames}
          tcgImportCount={games.length}
        />
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-text-primary">
          {isDe ? "Einträge in der Kampagne" : "Items in this campaign"} ({items.length})
          {!disabled && items.length > 1 && (
            <span className="ml-2 text-xs font-normal text-text-muted">
              {isDe ? "Reihenfolge per Drag-and-Drop ändern." : "Drag to reorder."}
            </span>
          )}
        </h3>
        {items.length === 0 ? (
          <p className="text-sm text-text-muted">
            {dict["upvoteCampaigns_pickerEmpty"] ?? "No items yet."}
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              <ul className="space-y-2">
                {itemsWithKeys.map(({ key, item }, idx) => (
                  <SortableItemRow
                    key={key}
                    sortableId={key}
                    item={item}
                    index={idx}
                    disabled={disabled}
                    isDe={isDe}
                    dict={dict}
                    onRemove={() => removeAt(idx)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}

interface SortableItemRowProps {
  sortableId: string;
  item: PickerItem;
  index: number;
  disabled?: boolean;
  isDe: boolean;
  dict: Record<string, string>;
  onRemove: () => void;
}

function SortableItemRow({
  sortableId,
  item,
  index,
  disabled,
  isDe,
  dict,
  onRemove,
}: SortableItemRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: sortableId, disabled });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    position: isDragging ? "relative" : undefined,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.85 : 1,
  };

  const label = itemDisplayLabel(item, isDe);
  const kindBadge =
    item.kind === "card"
      ? { variant: "success" as const, label: item.source === "internal" ? "Pool" : "JustTCG" }
      : item.kind === "box"
      ? { variant: "info" as const, label: isDe ? "Box" : "Box" }
      : { variant: "warning" as const, label: isDe ? "Option" : "Option" };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 bg-surface rounded-lg border ${
        isDragging ? "border-pa-green/50 shadow-lg" : "border-border"
      } touch-none`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        disabled={disabled}
        title={isDe ? "Zum Sortieren ziehen" : "Drag to reorder"}
        className="p-1 text-text-muted hover:text-text-primary cursor-grab active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-30"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <span className="text-xs text-text-muted w-6 text-right tabular-nums">{index + 1}</span>
      {item.image ? (
        <img src={item.image} alt="" className="w-10 h-14 object-cover rounded bg-surface-2" />
      ) : (
        <div className="w-10 h-14 bg-surface-2 rounded flex items-center justify-center text-text-muted">
          {item.kind === "box" ? <Package className="w-4 h-4" /> : "?"}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-text-primary truncate">{label}</div>
        <div className="text-xs text-text-muted truncate flex items-center gap-1">
          <Badge variant={kindBadge.variant}>{kindBadge.label}</Badge>
          {item.kind === "card" && item.setName && <span>· {item.setName}</span>}
          {item.kind === "card" && item.rarity && <Badge variant="info">{item.rarity}</Badge>}
          {item.kind === "box" && item.game && <span>· {item.game}</span>}
        </div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        title={dict["upvoteCampaigns_pickerRemove"] ?? "Remove"}
        className="p-1.5 rounded hover:bg-surface-2 text-red-400 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <X className="w-4 h-4" />
      </button>
    </li>
  );
}

interface PoolCardPickerProps {
  lang: string;
  dict: Record<string, string>;
  gameFilter: string;
  gameOptions: SelectOption[];
  onGameChange: (val: string) => void;
  onPick: (card: PoolCard) => void;
}

function PoolCardPicker({
  lang,
  dict,
  gameFilter,
  gameOptions,
  onGameChange,
  onPick,
}: PoolCardPickerProps) {
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

interface BoxPickerProps {
  lang: string;
  dict: Record<string, string>;
  onPick: (box: PoolBox) => void;
}

function BoxPicker({ lang, dict, onPick }: BoxPickerProps) {
  const isDe = lang === "de";
  const [q, setQ] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [results, setResults] = useState<PoolBox[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setQ(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      p.set("achievementOnly", "false");
      if (q) p.set("q", q);
      const res = await fetch(`/api/admin/boxes/search?${p.toString()}`);
      if (!res.ok) return;
      const data: { boxes: PoolBox[] } = await res.json();
      setResults(data.boxes);
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-3 p-4 bg-surface-2 rounded-lg border border-border">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <Input
          placeholder={isDe ? "Box suchen..." : "Search box..."}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-9 py-2 text-sm"
        />
      </div>

      {loading ? (
        <p className="text-xs text-text-muted">{isDe ? "Lädt..." : "Loading..."}</p>
      ) : results.length === 0 ? (
        <p className="text-xs text-text-muted">{isDe ? "Keine Boxen gefunden." : "No boxes found."}</p>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {results.map((b) => (
            <li
              key={b._id}
              className="flex items-center gap-2 p-2 bg-surface rounded border border-border"
            >
              {b.image ? (
                <img src={b.image} alt="" className="w-8 h-11 object-cover rounded" />
              ) : (
                <div className="w-8 h-11 bg-surface-2 rounded flex items-center justify-center text-text-muted">
                  <Package className="w-4 h-4" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-text-primary truncate">
                  {isDe ? b.name.de || b.name.en : b.name.en || b.name.de}
                </div>
                <div className="text-[11px] text-text-muted truncate">{b.slug}</div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => onPick(b)}>
                {dict["upvoteCampaigns_pickerAdd"] ?? "Add"}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface OptionPickerProps {
  lang: string;
  dict: Record<string, string>;
  onAdd: (option: { label: { de: string; en: string }; description?: { de: string; en: string }; image: string | null }) => void;
  onImportTcgs: () => void;
  tcgImportCount: number;
}

function OptionPicker({ lang, dict, onAdd, onImportTcgs, tcgImportCount }: OptionPickerProps) {
  const isDe = lang === "de";
  const [labelDe, setLabelDe] = useState("");
  const [labelEn, setLabelEn] = useState("");
  const [descDe, setDescDe] = useState("");
  const [descEn, setDescEn] = useState("");
  const [image, setImage] = useState("");

  const submit = () => {
    if (!labelDe.trim() || !labelEn.trim()) return;
    onAdd({
      label: { de: labelDe.trim(), en: labelEn.trim() },
      description:
        descDe.trim() || descEn.trim()
          ? { de: descDe.trim(), en: descEn.trim() }
          : undefined,
      image: image.trim() || null,
    });
    setLabelDe("");
    setLabelEn("");
    setDescDe("");
    setDescEn("");
    setImage("");
  };

  return (
    <div className="space-y-4 p-4 bg-surface-2 rounded-lg border border-border">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onImportTcgs}
        disabled={tcgImportCount === 0}
      >
        <Sparkles className="w-4 h-4 mr-1" />
        {(dict["upvoteCampaigns_importTcgs"] ?? "Import {{n}} TCGs from JustTCG").replace(
          "{{n}}",
          String(tcgImportCount)
        )}
      </Button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Input
          placeholder={isDe ? "Label (DE)" : "Label (DE)"}
          value={labelDe}
          onChange={(e) => setLabelDe(e.target.value)}
        />
        <Input
          placeholder={isDe ? "Label (EN)" : "Label (EN)"}
          value={labelEn}
          onChange={(e) => setLabelEn(e.target.value)}
        />
        <Input
          placeholder={isDe ? "Beschreibung (DE)" : "Description (DE)"}
          value={descDe}
          onChange={(e) => setDescDe(e.target.value)}
        />
        <Input
          placeholder={isDe ? "Beschreibung (EN)" : "Description (EN)"}
          value={descEn}
          onChange={(e) => setDescEn(e.target.value)}
        />
        <Input
          placeholder={isDe ? "Bild-URL (optional)" : "Image URL (optional)"}
          value={image}
          onChange={(e) => setImage(e.target.value)}
          className="md:col-span-2"
        />
      </div>

      <div className="flex justify-end">
        <Button
          variant="primary"
          size="sm"
          onClick={submit}
          disabled={!labelDe.trim() || !labelEn.trim()}
        >
          {dict["upvoteCampaigns_pickerAdd"] ?? "Add"}
        </Button>
      </div>
    </div>
  );
}
