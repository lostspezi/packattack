"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";

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

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStock, setEditStock] = useState(0);
  const [editEan, setEditEan] = useState("");
  const [editSku, setEditSku] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [saving, setSaving] = useState(false);

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [cardQuery, setCardQuery] = useState("");
  const [cardResults, setCardResults] = useState<CardDoc[]>([]);
  const [selectedCard, setSelectedCard] = useState<CardDoc | null>(null);
  const [addStock, setAddStock] = useState(0);
  const [addEan, setAddEan] = useState("");
  const [addSku, setAddSku] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [addPrice, setAddPrice] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/shop/inventory");
      const data = (await res.json()) as { items: InventoryItemRow[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Ladefehler");
      } else {
        setItems(data.items ?? []);
      }
    } catch {
      setError("Ladefehler");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchItems(); }, [fetchItems]);

  // Card search
  useEffect(() => {
    if (cardQuery.length < 2) {
      setCardResults([]);
      setShowDropdown(false);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/cards?q=${encodeURIComponent(cardQuery)}`);
        const data = (await res.json()) as { cards: CardDoc[] };
        setCardResults(data.cards ?? []);
        setShowDropdown(true);
      } catch {
        // ignore
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [cardQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function selectCard(card: CardDoc) {
    setSelectedCard(card);
    setCardQuery(card.name);
    setShowDropdown(false);
  }

  function resetAddForm() {
    setShowAddForm(false);
    setCardQuery("");
    setCardResults([]);
    setSelectedCard(null);
    setAddStock(0);
    setAddEan("");
    setAddSku("");
    setAddNotes("");
    setAddPrice("");
    setAddError(null);
  }

  async function submitAdd() {
    if (!selectedCard) {
      setAddError(isDe ? "Bitte eine Karte auswählen." : "Please select a card.");
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch("/api/shop/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: selectedCard._id,
          stock: addStock,
          ean: addEan || null,
          sku: addSku || null,
          notes: addNotes || null,
          pricePerUnit: addPrice ? parseFloat(addPrice) : null,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setAddError(data.error ?? "Fehler");
      } else {
        resetAddForm();
        await fetchItems();
      }
    } finally {
      setAdding(false);
    }
  }

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

  return (
    <div className="space-y-4">
      {/* Add button */}
      {!showAddForm && (
        <button
          onClick={() => setShowAddForm(true)}
          className="rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          {isDe ? "+ Artikel hinzufügen" : "+ Add item"}
        </button>
      )}

      {/* Add form */}
      {showAddForm && (
        <div className="rounded-lg border border-border bg-surface p-4 space-y-4">
          <h3 className="text-sm font-semibold text-text-primary">
            {isDe ? "Neuen Artikel anlegen" : "Add new item"}
          </h3>

          {/* Card search */}
          <div ref={searchRef} className="relative">
            <label className="block text-xs text-text-secondary mb-1">
              {isDe ? "Karte suchen *" : "Search card *"}
            </label>
            <input
              type="text"
              value={cardQuery}
              onChange={(e) => {
                setCardQuery(e.target.value);
                if (selectedCard && e.target.value !== selectedCard.name) {
                  setSelectedCard(null);
                }
              }}
              placeholder={isDe ? "Name eingeben…" : "Type name…"}
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {showDropdown && cardResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded border border-border bg-surface shadow-lg max-h-48 overflow-y-auto">
                {cardResults.map((card) => (
                  <button
                    key={card._id}
                    type="button"
                    onClick={() => selectCard(card)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-background flex items-center gap-2"
                  >
                    {card.image && (
                      <img src={card.image} alt="" className="w-6 h-8 object-contain rounded" />
                    )}
                    <div>
                      <span className="text-text-primary">{card.name}</span>
                      <span className="ml-2 text-xs text-text-secondary">
                        {card.game} · {card.rarity}
                        {card.internalPrice != null ? ` · ${card.internalPrice} Coins` : ""}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {showDropdown && cardResults.length === 0 && cardQuery.length >= 2 && (
              <div className="absolute z-10 mt-1 w-full rounded border border-border bg-surface px-3 py-2 text-sm text-text-secondary">
                {isDe ? "Keine Karten gefunden." : "No cards found."}
              </div>
            )}
          </div>

          {/* Stock + optional fields */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-text-secondary mb-1">
                {isDe ? "Bestand *" : "Stock *"}
              </label>
              <input
                type="number"
                min={0}
                value={addStock}
                onChange={(e) => setAddStock(parseInt(e.target.value, 10) || 0)}
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">EAN</label>
              <input
                type="text"
                value={addEan}
                onChange={(e) => setAddEan(e.target.value)}
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">SKU</label>
              <input
                type="text"
                value={addSku}
                onChange={(e) => setAddSku(e.target.value)}
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">
                {isDe ? "EK-Preis (€)" : "Buy price (€)"}
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={addPrice}
                onChange={(e) => setAddPrice(e.target.value)}
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">
              {isDe ? "Notiz" : "Notes"}
            </label>
            <input
              type="text"
              value={addNotes}
              onChange={(e) => setAddNotes(e.target.value)}
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>

          {addError && <p className="text-sm text-error">{addError}</p>}

          <div className="flex gap-2">
            <button
              onClick={() => void submitAdd()}
              disabled={adding}
              className="rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {adding
                ? isDe ? "Speichert…" : "Saving…"
                : isDe ? "Hinzufügen" : "Add"}
            </button>
            <button
              onClick={resetAddForm}
              className="rounded border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
            >
              {isDe ? "Abbrechen" : "Cancel"}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {items.length === 0 ? (
        <p className="text-sm text-text-secondary">
          {isDe ? "Noch keine Artikel im Inventar." : "No inventory items yet."}
        </p>
      ) : (
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
      )}
    </div>
  );
}
