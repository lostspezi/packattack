"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { PendingCards } from "@/components/inventory/pending-cards";
import { InventoryGrid } from "@/components/inventory/inventory-grid";

export default function InventoryPage() {
  const params = useParams<{ lang: string }>();
  const lang = params.lang ?? "en";
  const isDe = lang === "de";

  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">
          {isDe ? "Meine Sammlung" : "My Collection"}
        </h2>
        <p className="text-text-secondary mt-1 text-sm">
          {isDe ? "Deine geclaimten Karten und ausstehende Entscheidungen." : "Your claimed cards and pending decisions."}
        </p>
      </div>

      {/* Pending cards (with countdown) */}
      <PendingCards lang={lang} onDecision={() => setRefreshKey((k) => k + 1)} />

      {/* Claimed cards grid */}
      <InventoryGrid lang={lang} refreshKey={refreshKey} />
    </div>
  );
}
