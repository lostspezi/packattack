"use client";

import React, { useState, useCallback } from "react";
import { Search, Layers } from "lucide-react";
import { ShopCardSearch, ShopAddCardPayload } from "./shop-card-search";
import { ShopInventoryList, InventoryItemRow } from "./shop-inventory-list";

interface ShopInventoryManagerProps {
  lang: string;
}

export function ShopInventoryManager({ lang }: ShopInventoryManagerProps) {
  const isDe = lang === "de";

  const [existingInventoryIds, setExistingInventoryIds] = useState<Set<string>>(new Set());
  const [newItemId, setNewItemId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState<"search" | "inventory">("search");
  const [inventoryCount, setInventoryCount] = useState(0);

  const handleAdd = useCallback(async (payload: ShopAddCardPayload) => {
    const res = await fetch("/api/shop/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      throw new Error(data.error ?? "Failed to add");
    }

    const data = (await res.json()) as { _id: string };

    setExistingInventoryIds((prev) => {
      const next = new Set(prev);
      next.add(`${payload.justTcgId}_${payload.condition}`);
      return next;
    });

    setNewItemId(data._id);
    setRefreshKey((k) => k + 1);
    setActiveTab("inventory");
  }, []);

  const handleNewItemHandled = useCallback(() => {
    setNewItemId(null);
  }, []);

  const handleItemsLoaded = useCallback((items: InventoryItemRow[]) => {
    const ids = new Set<string>();
    for (const item of items) {
      if (item.card.justTcgId) {
        ids.add(`${item.card.justTcgId}_${item.condition}`);
      }
    }
    setExistingInventoryIds(ids);
    setInventoryCount(items.length);
  }, []);

  return (
    <div className="h-full">
      {/* Mobile tabs */}
      <div className="flex lg:hidden border-b border-border mb-4">
        <button
          onClick={() => setActiveTab("search")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "search"
              ? "border-pa-green text-pa-green"
              : "border-transparent text-text-muted hover:text-text-secondary"
          }`}
        >
          <Search className="w-4 h-4" />
          {isDe ? "Suche" : "Search"}
        </button>
        <button
          onClick={() => setActiveTab("inventory")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "inventory"
              ? "border-pa-green text-pa-green"
              : "border-transparent text-text-muted hover:text-text-secondary"
          }`}
        >
          <Layers className="w-4 h-4" />
          {isDe ? "Inventar" : "Inventory"}
          {inventoryCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-pa-green/15 text-pa-green font-medium">
              {inventoryCount}
            </span>
          )}
        </button>
      </div>

      {/* Two columns desktop / tab content mobile */}
      <div className="flex gap-6 h-[calc(100vh-200px)]">
        <div className={`lg:w-[40%] lg:border-r lg:border-border lg:pr-6 overflow-y-auto ${
          activeTab === "search" ? "block" : "hidden lg:block"
        }`}>
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
            {isDe ? "Kartensuche" : "Card Search"}
          </h3>
          <ShopCardSearch
            existingInventoryIds={existingInventoryIds}
            onAdd={handleAdd}
            lang={lang}
          />
        </div>

        <div className={`lg:flex-1 overflow-y-auto ${
          activeTab === "inventory" ? "block" : "hidden lg:block"
        }`}>
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
            {isDe ? "Mein Inventar" : "My Inventory"}
          </h3>
          <ShopInventoryList
            lang={lang}
            newItemId={newItemId}
            onNewItemHandled={handleNewItemHandled}
            onItemsLoaded={handleItemsLoaded}
            refreshKey={refreshKey}
          />
        </div>
      </div>
    </div>
  );
}
