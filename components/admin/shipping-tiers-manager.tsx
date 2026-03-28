"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Plus } from "lucide-react";
import { useToast } from "@/components/ui/toast";

interface ShippingTier {
  _id: string;
  country: string;
  minCards: number;
  maxCards: number;
  costCents: number;
  costCoins: number;
  isActive: boolean;
}

export function ShippingTiersManager({ dict }: { lang: string; dict: Record<string, string> }) {
  const { toast } = useToast();
  const [tiers, setTiers] = useState<ShippingTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ country: "DE", minCards: "1", maxCards: "5", costCents: "299", costCoins: "150" });

  const fetchTiers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/shipping-tiers");
      const data = await res.json();
      setTiers(data.tiers || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTiers(); }, [fetchTiers]);

  async function handleCreate() {
    setCreating(true);
    try {
      const res = await fetch("/api/admin/shipping-tiers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country: form.country,
          minCards: parseInt(form.minCards, 10),
          maxCards: parseInt(form.maxCards, 10),
          costCents: parseInt(form.costCents, 10),
          costCoins: parseInt(form.costCoins, 10),
          isActive: true,
        }),
      });
      const data = await res.json();
      if (data._id) {
        toast({ type: "success", title: dict["shipping_tierCreated"] ?? "Tier created" });
        setShowForm(false);
        fetchTiers();
      } else {
        toast({ type: "error", title: data.error || "Error" });
      }
    } catch {
      toast({ type: "error", title: "Network error" });
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-text-muted" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-white/2">
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">{dict["shipping_country"] ?? "Country"}</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Min</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Max</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">{dict["shipping_costCents"] ?? "Cost (Cents)"}</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Coins</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">{dict["shipping_active"] ?? "Active"}</th>
            </tr>
          </thead>
          <tbody>
            {tiers.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-text-muted">{dict["shipping_noTiers"] ?? "No tiers"}</td></tr>
            ) : tiers.map((t) => (
              <tr key={t._id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-text-primary">{t.country}</td>
                <td className="px-4 py-3 text-text-secondary">{t.minCards}</td>
                <td className="px-4 py-3 text-text-secondary">{t.maxCards}</td>
                <td className="px-4 py-3 text-text-secondary">{t.costCents}</td>
                <td className="px-4 py-3 text-text-secondary">{t.costCoins}</td>
                <td className="px-4 py-3">
                  <span className={t.isActive ? "text-green-400" : "text-red-400"}>{t.isActive ? "\u2713" : "\u2717"}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!showForm ? (
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 rounded-lg bg-pa-green/10 px-4 py-2 text-sm font-medium text-pa-green hover:bg-pa-green/20">
          <Plus className="h-4 w-4" /> {dict["shipping_addTier"] ?? "Add Tier"}
        </button>
      ) : (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">{dict["shipping_newTier"] ?? "New Tier"}</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <select value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary">
              <option value="DE">DE</option>
              <option value="AT">AT</option>
              <option value="CH">CH</option>
            </select>
            <input type="number" placeholder="Min" value={form.minCards} onChange={(e) => setForm((f) => ({ ...f, minCards: e.target.value }))} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary" />
            <input type="number" placeholder="Max" value={form.maxCards} onChange={(e) => setForm((f) => ({ ...f, maxCards: e.target.value }))} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary" />
            <input type="number" placeholder="Cents" value={form.costCents} onChange={(e) => setForm((f) => ({ ...f, costCents: e.target.value }))} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary" />
            <input type="number" placeholder="Coins" value={form.costCoins} onChange={(e) => setForm((f) => ({ ...f, costCoins: e.target.value }))} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={creating} className="flex items-center gap-2 rounded-lg bg-pa-green px-4 py-2 text-sm font-medium text-black hover:bg-pa-green/90 disabled:opacity-50">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {dict["shipping_create"] ?? "Create"}
            </button>
            <button onClick={() => setShowForm(false)} className="rounded-lg border border-border px-4 py-2 text-sm text-text-secondary hover:bg-white/5">
              {dict["shipping_cancel"] ?? "Cancel"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
