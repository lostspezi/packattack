"use client";

import React, { useState, useEffect, useCallback } from "react";

interface CardDoc {
  _id: string;
  name: string;
  game: string;
  rarity: string;
  image: string | null;
  internalPrice: number | null;
}

interface InventoryItemRow {
  _id: string;
  card: CardDoc;
  stock: number;
  ean: string | null;
  sku: string | null;
  notes: string | null;
  pricePerUnit: number | null;
}

export function ShopInventoryTable({ lang }: { lang: string }) {
  const isDe = lang === "de";
  const [items, setItems] = useState<InventoryItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStock, setEditStock] = useState(0);
  const [editEan, setEditEan] = useState("");
  const [editSku, setEditSku] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/shop/inventory");
      const data = (await res.json()) as { items: InventoryItemRow[] };
      setItems(data.items ?? []);
    } catch {
      setError("Ladefehler");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchItems(); }, [fetchItems]);

  function startEdit(item: InventoryItemRow) {
    setEditingId(item._id);
    setEditStock(item.stock);
    setEditEan(item.ean ?? "");
    setEditSku(item.sku ?? "");
    setEditNotes(item.notes ?? "");
    setEditPrice(item.pricePerUnit?.toString() ?? "");
  }

  async function saveEdit(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/shop/inventory/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stock: editStock,
          ean: editEan || null,
          sku: editSku || null,
          notes: editNotes || null,
          pricePerUnit: editPrice ? parseFloat(editPrice) : null,
        }),
      });
      if (res.ok) {
        setEditingId(null);
        await fetchItems();
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(id: string) {
    if (!confirm(isDe ? "Wirklich löschen?" : "Delete this item?")) return;
    const res = await fetch(`/api/shop/inventory/${id}`, { method: "DELETE" });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      alert(data.error ?? "Fehler");
    } else {
      await fetchItems();
    }
  }

  if (loading) return <p className="text-sm text-text-secondary">{isDe ? "Lädt…" : "Loading…"}</p>;
  if (error) return <p className="text-sm text-error">{error}</p>;
  if (items.length === 0) {
    return (
      <p className="text-sm text-text-secondary">
        {isDe ? "Noch keine Artikel im Inventar." : "No inventory items yet."}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-text-secondary">
            <th className="py-2 pr-4">{isDe ? "Karte" : "Card"}</th>
            <th className="py-2 pr-4">{isDe ? "Bestand" : "Stock"}</th>
            <th className="py-2 pr-4">EAN</th>
            <th className="py-2 pr-4">SKU</th>
            <th className="py-2 pr-4">{isDe ? "EK-Preis" : "Buy price"}</th>
            <th className="py-2 pr-4">{isDe ? "Notiz" : "Notes"}</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) =>
            editingId === item._id ? (
              <tr key={item._id} className="border-b border-border">
                <td className="py-2 pr-4 font-medium text-text-primary">{item.card.name}</td>
                <td className="py-2 pr-4">
                  <input
                    type="number"
                    min={0}
                    value={editStock}
                    onChange={(e) => setEditStock(parseInt(e.target.value, 10) || 0)}
                    className="w-20 rounded border border-border bg-background px-2 py-1 text-sm"
                  />
                </td>
                <td className="py-2 pr-4">
                  <input
                    type="text"
                    value={editEan}
                    onChange={(e) => setEditEan(e.target.value)}
                    className="w-28 rounded border border-border bg-background px-2 py-1 text-sm"
                  />
                </td>
                <td className="py-2 pr-4">
                  <input
                    type="text"
                    value={editSku}
                    onChange={(e) => setEditSku(e.target.value)}
                    className="w-28 rounded border border-border bg-background px-2 py-1 text-sm"
                  />
                </td>
                <td className="py-2 pr-4">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="w-20 rounded border border-border bg-background px-2 py-1 text-sm"
                  />
                </td>
                <td className="py-2 pr-4">
                  <input
                    type="text"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="w-40 rounded border border-border bg-background px-2 py-1 text-sm"
                  />
                </td>
                <td className="py-2 flex gap-2">
                  <button
                    onClick={() => void saveEdit(item._id)}
                    disabled={saving}
                    className="rounded bg-primary px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                  >
                    {isDe ? "Speichern" : "Save"}
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="rounded border border-border px-2 py-1 text-xs text-text-secondary"
                  >
                    {isDe ? "Abbrechen" : "Cancel"}
                  </button>
                </td>
              </tr>
            ) : (
              <tr key={item._id} className="border-b border-border hover:bg-surface/50">
                <td className="py-2 pr-4 font-medium text-text-primary">{item.card.name}</td>
                <td className="py-2 pr-4 text-text-secondary">{item.stock}</td>
                <td className="py-2 pr-4 text-text-secondary">{item.ean ?? "—"}</td>
                <td className="py-2 pr-4 text-text-secondary">{item.sku ?? "—"}</td>
                <td className="py-2 pr-4 text-text-secondary">
                  {item.pricePerUnit != null ? `${item.pricePerUnit.toFixed(2)} €` : "—"}
                </td>
                <td className="py-2 pr-4 text-text-secondary max-w-[160px] truncate">{item.notes ?? "—"}</td>
                <td className="py-2 flex gap-2">
                  <button
                    onClick={() => startEdit(item)}
                    className="rounded border border-border px-2 py-1 text-xs text-text-secondary hover:text-text-primary"
                  >
                    {isDe ? "Bearbeiten" : "Edit"}
                  </button>
                  <button
                    onClick={() => void deleteItem(item._id)}
                    className="rounded border border-error/40 px-2 py-1 text-xs text-error hover:bg-error/10"
                  >
                    {isDe ? "Löschen" : "Delete"}
                  </button>
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}
