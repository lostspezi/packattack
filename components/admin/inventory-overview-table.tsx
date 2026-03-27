"use client";

import React, { useState, useEffect, useCallback } from "react";

interface InventoryRow {
  _id: string;
  card: { _id: string; name: string; game: string; rarity: string; internalPrice: number | null };
  shop: { _id: string; name: string; email: string };
  stock: number;
  ean: string | null;
  sku: string | null;
  notes: string | null;
  pricePerUnit: number | null;
}

export function InventoryOverviewTable({ lang }: { lang: string }) {
  const isDe = lang === "de";
  const [items, setItems] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStock, setEditStock] = useState(0);
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/inventory?limit=100");
      const data = (await res.json()) as { items: InventoryRow[] };
      setItems(data.items ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchItems(); }, [fetchItems]);

  async function saveOverride(id: string) {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/inventory/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock: editStock, notes: editNotes || null }),
      });
      if (res.ok) {
        setEditingId(null);
        await fetchItems();
      } else {
        const d = (await res.json()) as { error?: string };
        setFeedback(d.error ?? "Fehler");
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-text-secondary">{isDe ? "Lädt…" : "Loading…"}</p>;
  if (items.length === 0) {
    return (
      <p className="text-sm text-text-secondary">
        {isDe ? "Kein Inventar vorhanden." : "No inventory items."}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {feedback && <p className="text-sm text-error">{feedback}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-text-secondary">
              <th className="py-2 pr-4">{isDe ? "Karte" : "Card"}</th>
              <th className="py-2 pr-4">Shop</th>
              <th className="py-2 pr-4">{isDe ? "Bestand" : "Stock"}</th>
              <th className="py-2 pr-4">EAN</th>
              <th className="py-2 pr-4">SKU</th>
              <th className="py-2 pr-4">{isDe ? "Notiz" : "Notes"}</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) =>
              editingId === item._id ? (
                <tr key={item._id} className="border-b border-border">
                  <td className="py-2 pr-4 font-medium text-text-primary">{item.card.name}</td>
                  <td className="py-2 pr-4 text-text-secondary">{item.shop.name}</td>
                  <td className="py-2 pr-4">
                    <input
                      type="number"
                      min={0}
                      value={editStock}
                      onChange={(e) => setEditStock(parseInt(e.target.value, 10) || 0)}
                      className="w-20 rounded border border-border bg-background px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="py-2 pr-4 text-text-secondary">{item.ean ?? "—"}</td>
                  <td className="py-2 pr-4 text-text-secondary">{item.sku ?? "—"}</td>
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
                      onClick={() => void saveOverride(item._id)}
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
                  <td className="py-2 pr-4">
                    <div className="font-medium text-text-primary">{item.card.name}</div>
                    <div className="text-xs text-text-secondary">{item.card.game} · {item.card.rarity}</div>
                  </td>
                  <td className="py-2 pr-4 text-text-secondary">{item.shop.name}</td>
                  <td className="py-2 pr-4 text-text-secondary">{item.stock}</td>
                  <td className="py-2 pr-4 text-text-secondary">{item.ean ?? "—"}</td>
                  <td className="py-2 pr-4 text-text-secondary">{item.sku ?? "—"}</td>
                  <td className="py-2 pr-4 text-text-secondary max-w-[160px] truncate">{item.notes ?? "—"}</td>
                  <td className="py-2">
                    <button
                      onClick={() => {
                        setEditingId(item._id);
                        setEditStock(item.stock);
                        setEditNotes(item.notes ?? "");
                      }}
                      className="rounded border border-border px-2 py-1 text-xs text-text-secondary hover:text-text-primary"
                    >
                      Override
                    </button>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
