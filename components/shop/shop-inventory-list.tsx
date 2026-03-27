"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Pencil, Save, X, Trash2, Loader2 } from "lucide-react";

export interface InventoryItemRow {
  _id: string;
  card: {
    _id: string;
    name: string;
    game: string;
    rarity: string;
    image: string | null;
    tcgplayerId: string | null;
    justTcgId?: string;
    setName: string;
    set: string;
  };
  condition: string;
  stock: number;
  ean: string | null;
  sku: string | null;
  notes: string | null;
  netPrice: number | null;
}

interface ShopInventoryListProps {
  lang: string;
  newItemId: string | null;
  onNewItemHandled: () => void;
  onItemsLoaded?: (items: InventoryItemRow[]) => void;
  refreshKey: number;
}

const CONDITIONS = [
  "Mint",
  "Near Mint",
  "Lightly Played",
  "Moderately Played",
  "Heavily Played",
] as const;

function getThumbnail(item: InventoryItemRow): string | null {
  if (item.card.tcgplayerId) {
    return `https://tcgplayer-cdn.tcgplayer.com/product/${item.card.tcgplayerId}_200w.jpg`;
  }
  return item.card.image;
}

export function ShopInventoryList({
  lang,
  newItemId,
  onNewItemHandled,
  onItemsLoaded,
  refreshKey,
}: ShopInventoryListProps) {
  const isDe = lang === "de";

  const [items, setItems] = useState<InventoryItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCondition, setEditCondition] = useState("");
  const [editStock, setEditStock] = useState(0);
  const [editNetPrice, setEditNetPrice] = useState("");
  const [editSku, setEditSku] = useState("");
  const [editEan, setEditEan] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Delete state
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Track whether newItemId has been handled
  const handledNewItemRef = useRef<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/shop/inventory?limit=200");
      const data = (await res.json()) as { items: InventoryItemRow[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? (isDe ? "Ladefehler" : "Load error"));
      } else {
        const loadedItems = data.items ?? [];
        setItems(loadedItems);
        onItemsLoaded?.(loadedItems);
      }
    } catch {
      setError(isDe ? "Ladefehler" : "Load error");
    } finally {
      setLoading(false);
    }
  }, [isDe]);

  // Fetch on mount and whenever refreshKey changes
  useEffect(() => {
    void fetchItems();
  }, [fetchItems, refreshKey]);

  // Auto-edit mode: open new item in edit mode once it appears in the list
  useEffect(() => {
    if (!newItemId) return;
    if (handledNewItemRef.current === newItemId) return;
    const found = items.find((i) => i._id === newItemId);
    if (found) {
      handledNewItemRef.current = newItemId;
      startEdit(found);
      onNewItemHandled();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newItemId, items]);

  function startEdit(item: InventoryItemRow) {
    setEditingId(item._id);
    setEditCondition(item.condition);
    setEditStock(item.stock);
    setEditNetPrice(item.netPrice?.toString() ?? "");
    setEditSku(item.sku ?? "");
    setEditEan(item.ean ?? "");
    setEditNotes(item.notes ?? "");
    setSaveError(null);
    setDeleteError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setSaveError(null);
  }

  async function saveEdit(id: string) {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/shop/inventory/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          condition: editCondition,
          stock: editStock,
          netPrice: editNetPrice !== "" ? parseFloat(editNetPrice) : null,
          sku: editSku || null,
          ean: editEan || null,
          notes: editNotes || null,
        }),
      });
      if (res.ok) {
        setEditingId(null);
        await fetchItems();
      } else {
        const data = (await res.json()) as { error?: string };
        setSaveError(data.error ?? (isDe ? "Speicherfehler" : "Save error"));
      }
    } catch {
      setSaveError(isDe ? "Speicherfehler" : "Save error");
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(id: string) {
    const confirmed = confirm(
      isDe ? "Wirklich löschen?" : "Delete this item?"
    );
    if (!confirmed) return;
    setDeleteError(null);
    const res = await fetch(`/api/shop/inventory/${id}`, { method: "DELETE" });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      if (res.status === 409) {
        setDeleteError(
          data.error ??
            (isDe
              ? "Dieser Artikel wird als Ersatz verwendet und kann nicht gelöscht werden."
              : "This item is used as a substitute and cannot be deleted.")
        );
      } else {
        setDeleteError(data.error ?? (isDe ? "Fehler" : "Error"));
      }
    } else {
      await fetchItems();
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-text-secondary text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>{isDe ? "Lädt…" : "Loading…"}</span>
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-error py-4">{error}</p>;
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-text-secondary text-sm">
          {isDe
            ? "Noch keine Artikel im Inventar. Suche links nach Karten, um sie hinzuzufügen."
            : "No inventory items yet. Search for cards on the left to add them."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {deleteError && (
        <p className="text-sm text-error rounded border border-error/20 bg-error/10 px-3 py-2">
          {deleteError}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-left text-text-muted">
              <th className="py-2 pr-2 w-8"></th>
              <th className="py-2 pr-3">{isDe ? "Karte" : "Card"}</th>
              <th className="py-2 pr-3">{isDe ? "Zustand" : "Condition"}</th>
              <th className="py-2 pr-3">{isDe ? "Bestand" : "Stock"}</th>
              <th className="py-2 pr-3">{isDe ? "Netto-Preis" : "Net Price"}</th>
              <th className="py-2 pr-3">SKU</th>
              <th className="py-2 pr-3">EAN</th>
              <th className="py-2 pr-3">{isDe ? "Notiz" : "Notes"}</th>
              <th className="py-2 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const isEditing = editingId === item._id;
              const thumb = getThumbnail(item);

              return (
                <tr
                  key={item._id}
                  className={`border-b border-border ${
                    isEditing ? "bg-white/2" : "hover:bg-white/2"
                  }`}
                >
                  {/* Thumbnail */}
                  <td className="py-2 pr-2">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={item.card.name}
                        width={28}
                        height={40}
                        className="rounded object-contain"
                        style={{ width: 28, height: 40 }}
                      />
                    ) : (
                      <div
                        className="rounded bg-surface"
                        style={{ width: 28, height: 40 }}
                      />
                    )}
                  </td>

                  {/* Card name + set */}
                  <td className="py-2 pr-3">
                    <p className="font-medium text-text-primary leading-tight">
                      {item.card.name}
                    </p>
                    <p className="text-text-secondary leading-tight">
                      {item.card.setName || item.card.set}
                    </p>
                  </td>

                  {/* Condition */}
                  <td className="py-2 pr-3">
                    {isEditing ? (
                      <select
                        value={editCondition}
                        onChange={(e) => setEditCondition(e.target.value)}
                        className="rounded border border-border bg-background px-2 py-1 text-xs"
                      >
                        {CONDITIONS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-text-secondary">{item.condition}</span>
                    )}
                  </td>

                  {/* Stock */}
                  <td className="py-2 pr-3">
                    {isEditing ? (
                      <input
                        type="number"
                        min={0}
                        value={editStock}
                        onChange={(e) =>
                          setEditStock(parseInt(e.target.value, 10) || 0)
                        }
                        className="w-16 rounded border border-border bg-background px-2 py-1 text-xs"
                      />
                    ) : (
                      <span className="text-text-secondary">{item.stock}</span>
                    )}
                  </td>

                  {/* Net Price */}
                  <td className="py-2 pr-3">
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={editNetPrice}
                          onChange={(e) => setEditNetPrice(e.target.value)}
                          className="w-20 rounded border border-border bg-background px-2 py-1 text-xs"
                        />
                        <span className="text-text-muted">€</span>
                      </div>
                    ) : (
                      <span className="text-text-secondary">
                        {item.netPrice != null
                          ? `${item.netPrice.toFixed(2)} €`
                          : "—"}
                      </span>
                    )}
                  </td>

                  {/* SKU */}
                  <td className="py-2 pr-3">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editSku}
                        onChange={(e) => setEditSku(e.target.value)}
                        className="w-24 rounded border border-border bg-background px-2 py-1 text-xs"
                      />
                    ) : (
                      <span className="text-text-secondary">{item.sku ?? "—"}</span>
                    )}
                  </td>

                  {/* EAN */}
                  <td className="py-2 pr-3">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editEan}
                        onChange={(e) => setEditEan(e.target.value)}
                        className="w-28 rounded border border-border bg-background px-2 py-1 text-xs"
                      />
                    ) : (
                      <span className="text-text-secondary">{item.ean ?? "—"}</span>
                    )}
                  </td>

                  {/* Notes */}
                  <td className="py-2 pr-3">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        className="w-32 rounded border border-border bg-background px-2 py-1 text-xs"
                      />
                    ) : (
                      <span className="text-text-secondary max-w-[128px] truncate block">
                        {item.notes ?? "—"}
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-2">
                    {isEditing ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => void saveEdit(item._id)}
                            disabled={saving}
                            title={isDe ? "Speichern" : "Save"}
                            className="rounded p-1 text-pa-green hover:bg-white/5 disabled:opacity-50"
                          >
                            {saving ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Save className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            onClick={cancelEdit}
                            title={isDe ? "Abbrechen" : "Cancel"}
                            className="rounded p-1 text-text-muted hover:text-text-primary hover:bg-white/5"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {saveError && (
                          <p className="text-error text-xs max-w-[120px]">{saveError}</p>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => startEdit(item)}
                          title={isDe ? "Bearbeiten" : "Edit"}
                          className="rounded p-1 text-text-muted hover:text-text-primary hover:bg-white/5"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => void deleteItem(item._id)}
                          title={isDe ? "Löschen" : "Delete"}
                          className="rounded p-1 text-text-muted hover:text-error hover:bg-white/5"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
