"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { InventoryGrid } from "@/components/inventory/inventory-grid";

export default function InventoryPage() {
  const params = useParams<{ lang: string }>();
  const lang = params.lang ?? "en";
  const isDe = lang === "de";

  const [refreshKey] = useState(0);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">
          {isDe ? "Meine Sammlung" : "My Collection"}
        </h2>
        <p className="text-text-secondary mt-1 text-sm">
          {isDe ? "Deine geclaimten Karten." : "Your claimed cards."}
        </p>
      </div>

      <InventoryGrid lang={lang} refreshKey={refreshKey} />
    </div>
  );
}
