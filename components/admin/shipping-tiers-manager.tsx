"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Plus, Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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

const emptyForm = { country: "DE", minCards: "1", maxCards: "5", costCents: "299", costCoins: "150" };

export function ShippingTiersManager({ dict }: { lang: string; dict: Record<string, string> }) {
  const { toast } = useToast();
  const [tiers, setTiers] = useState<ShippingTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

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

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  }

  function handleEdit(tier: ShippingTier) {
    setEditingId(tier._id);
    setForm({
      country: tier.country,
      minCards: String(tier.minCards),
      maxCards: String(tier.maxCards),
      costCents: String(tier.costCents),
      costCoins: String(tier.costCoins),
    });
    setShowForm(true);
  }

  async function handleSubmit() {
    const minCards = parseInt(form.minCards, 10);
    const maxCards = parseInt(form.maxCards, 10);
    const costCents = parseInt(form.costCents, 10);
    const costCoins = parseInt(form.costCoins, 10);

    if (!Number.isFinite(minCards) || !Number.isFinite(maxCards) || !Number.isFinite(costCents) || !Number.isFinite(costCoins)) {
      toast({ type: "error", title: dict["shipping_errorInvalidNumbers"] ?? "Alle Zahlenfelder müssen ausgefüllt sein" });
      return;
    }
    if (minCards < 1 || maxCards < 1) {
      toast({ type: "error", title: dict["shipping_errorMinOne"] ?? "Min. und Max. Karten müssen ≥ 1 sein" });
      return;
    }
    if (costCents < 0 || costCoins < 0) {
      toast({ type: "error", title: dict["shipping_errorCostsNegative"] ?? "Kosten dürfen nicht negativ sein" });
      return;
    }
    if (minCards > maxCards) {
      toast({ type: "error", title: dict["shipping_errorMinMax"] ?? "Min. Karten darf nicht größer als Max. Karten sein" });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        country: form.country,
        minCards,
        maxCards,
        costCents,
        costCoins,
      };

      const url = editingId
        ? `/api/admin/shipping-tiers/${editingId}`
        : "/api/admin/shipping-tiers";
      const method = editingId ? "PUT" : "POST";
      const body = editingId ? payload : { ...payload, isActive: true };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        toast({ type: "error", title: data.error || "Error" });
        return;
      }

      toast({
        type: "success",
        title: editingId
          ? (dict["shipping_tierUpdated"] ?? "Stufe aktualisiert")
          : (dict["shipping_tierCreated"] ?? "Stufe erstellt"),
      });
      resetForm();
      fetchTiers();
    } catch {
      toast({ type: "error", title: "Network error" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(tier: ShippingTier) {
    setUpdatingId(tier._id);
    try {
      const res = await fetch(`/api/admin/shipping-tiers/${tier._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !tier.isActive }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ type: "error", title: data.error || "Fehler" });
        return;
      }
      toast({
        type: "success",
        title: tier.isActive
          ? (dict["shipping_tierDeactivated"] ?? "Stufe deaktiviert")
          : (dict["shipping_tierActivated"] ?? "Stufe aktiviert"),
      });
      fetchTiers();
    } catch {
      toast({ type: "error", title: "Network error" });
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDelete(tier: ShippingTier) {
    const confirmMsg = dict["shipping_confirmDelete"]
      ?? `Stufe ${tier.country} ${tier.minCards}-${tier.maxCards} wirklich löschen?`;
    if (!confirm(confirmMsg)) return;

    setUpdatingId(tier._id);
    try {
      const res = await fetch(`/api/admin/shipping-tiers/${tier._id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ type: "error", title: data.error || "Fehler beim Löschen" });
        return;
      }
      toast({ type: "success", title: dict["shipping_tierDeleted"] ?? "Stufe gelöscht" });
      fetchTiers();
    } catch {
      toast({ type: "error", title: "Network error" });
    } finally {
      setUpdatingId(null);
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
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">{dict["shipping_country"] ?? "Land"}</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">{dict["shipping_minCards"] ?? "Min. Karten"}</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">{dict["shipping_maxCards"] ?? "Max. Karten"}</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">{dict["shipping_costCents"] ?? "Kosten (Cent)"}</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">{dict["shipping_costCoins"] ?? "Kosten (Coins)"}</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">{dict["shipping_active"] ?? "Aktiv"}</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-text-muted">{dict["shipping_actions"] ?? "Aktionen"}</th>
            </tr>
          </thead>
          <tbody>
            {tiers.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-text-muted">{dict["shipping_noTiers"] ?? "Keine Stufen"}</td></tr>
            ) : tiers.map((t) => (
              <tr
                key={t._id}
                className={`border-b border-border last:border-0 ${editingId === t._id ? "bg-pa-green/5" : ""}`}
              >
                <td className="px-4 py-3 text-text-primary">{t.country}</td>
                <td className="px-4 py-3 text-text-secondary">{t.minCards}</td>
                <td className="px-4 py-3 text-text-secondary">{t.maxCards}</td>
                <td className="px-4 py-3 text-text-secondary">{t.costCents}</td>
                <td className="px-4 py-3 text-text-secondary">{t.costCoins}</td>
                <td className="px-4 py-3">
                  <span className={t.isActive ? "text-green-400" : "text-red-400"}>{t.isActive ? "✓" : "✗"}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => handleEdit(t)}
                      disabled={updatingId === t._id || submitting || editingId === t._id}
                      aria-label={dict["shipping_edit"] ?? "Bearbeiten"}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      {dict["shipping_edit"] ?? "Bearbeiten"}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => handleToggleActive(t)}
                      loading={updatingId === t._id}
                    >
                      {t.isActive
                        ? (dict["shipping_deactivate"] ?? "Deaktivieren")
                        : (dict["shipping_activate"] ?? "Aktivieren")}
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => handleDelete(t)}
                      loading={updatingId === t._id}
                      aria-label={dict["shipping_delete"] ?? "Löschen"}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {dict["shipping_delete"] ?? "Löschen"}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!showForm ? (
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 rounded-lg bg-pa-green/10 px-4 py-2 text-sm font-medium text-pa-green hover:bg-pa-green/20">
          <Plus className="h-4 w-4" /> {dict["shipping_addTier"] ?? "Stufe hinzufügen"}
        </button>
      ) : (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">
            {editingId
              ? (dict["shipping_editTier"] ?? "Stufe bearbeiten")
              : (dict["shipping_newTier"] ?? "Neue Stufe")}
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-text-muted">{dict["shipping_country"] ?? "Land"}</span>
              <select value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary">
                <option value="DE">DE</option>
                <option value="AT">AT</option>
                <option value="CH">CH</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-text-muted">{dict["shipping_minCards"] ?? "Min. Karten"}</span>
              <input type="number" min={1} value={form.minCards} onChange={(e) => setForm((f) => ({ ...f, minCards: e.target.value }))} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-text-muted">{dict["shipping_maxCards"] ?? "Max. Karten"}</span>
              <input type="number" min={1} value={form.maxCards} onChange={(e) => setForm((f) => ({ ...f, maxCards: e.target.value }))} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-text-muted">{dict["shipping_costCents"] ?? "Kosten (Cent)"}</span>
              <input type="number" min={0} value={form.costCents} onChange={(e) => setForm((f) => ({ ...f, costCents: e.target.value }))} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-text-muted">{dict["shipping_costCoins"] ?? "Kosten (Coins)"}</span>
              <input type="number" min={0} value={form.costCoins} onChange={(e) => setForm((f) => ({ ...f, costCoins: e.target.value }))} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary" />
            </label>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSubmit} disabled={submitting} className="flex items-center gap-2 rounded-lg bg-pa-green px-4 py-2 text-sm font-medium text-black hover:bg-pa-green/90 disabled:opacity-50">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {editingId
                ? (dict["shipping_save"] ?? "Speichern")
                : (dict["shipping_create"] ?? "Erstellen")}
            </button>
            <button onClick={resetForm} className="rounded-lg border border-border px-4 py-2 text-sm text-text-secondary hover:bg-white/5">
              {dict["shipping_cancel"] ?? "Abbrechen"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
