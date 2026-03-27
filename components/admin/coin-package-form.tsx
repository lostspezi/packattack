"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useToast } from "@/components/ui/toast-context";

interface CoinPackageFormProps {
  lang: string;
  dict: Record<string, string>;
  editData: {
    _id: string;
    name: { de: string; en: string };
    baseCoins: number;
    bonusCoins: number;
    priceEurCents: number;
    isActive: boolean;
    sortOrder: number;
    icon: string | null;
    highlightLabel: { de: string; en: string } | null;
  } | null;
  onClose: () => void;
}

export function CoinPackageForm({
  dict,
  editData,
  onClose,
}: CoinPackageFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nameDe: editData?.name.de || "",
    nameEn: editData?.name.en || "",
    baseCoins: editData?.baseCoins || 10,
    bonusCoins: editData?.bonusCoins || 0,
    priceEurCents: editData?.priceEurCents || 1000,
    isActive: editData?.isActive ?? true,
    sortOrder: editData?.sortOrder || 0,
    icon: editData?.icon || "",
    highlightDe: editData?.highlightLabel?.de || "",
    highlightEn: editData?.highlightLabel?.en || "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const payload = {
      name: { de: form.nameDe, en: form.nameEn },
      baseCoins: form.baseCoins,
      bonusCoins: form.bonusCoins,
      priceEurCents: form.priceEurCents,
      isActive: form.isActive,
      sortOrder: form.sortOrder,
      icon: form.icon || null,
      highlightLabel:
        form.highlightDe || form.highlightEn
          ? { de: form.highlightDe, en: form.highlightEn }
          : null,
    };

    try {
      const url = editData
        ? `/api/admin/coin-packages/${editData._id}`
        : "/api/admin/coin-packages";
      const method = editData ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast({
          type: "success",
          title: editData
            ? dict.packageUpdated || "Paket aktualisiert"
            : dict.packageCreated || "Paket erstellt",
        });
        onClose();
      } else {
        const data = await res.json();
        toast({
          type: "error",
          title: dict.error || "Fehler",
          message: data.error || "Unbekannter Fehler",
        });
      }
    } catch {
      toast({ type: "error", title: "Fehler" });
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-pa-green focus:outline-none";

  return (
    <div className="bg-surface border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-bold">
          {editData
            ? dict.editPackage || "Paket bearbeiten"
            : dict.createPackage || "Neues Paket erstellen"}
        </h3>
        <button
          onClick={onClose}
          className="text-text-secondary hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-text-secondary text-xs mb-1 block">
              Name (DE)
            </label>
            <input
              className={inputClass}
              value={form.nameDe}
              onChange={(e) => setForm({ ...form, nameDe: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="text-text-secondary text-xs mb-1 block">
              Name (EN)
            </label>
            <input
              className={inputClass}
              value={form.nameEn}
              onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-text-secondary text-xs mb-1 block">
              {dict.baseCoins || "Basis-Münzen"} (max 1000)
            </label>
            <input
              type="number"
              className={inputClass}
              value={form.baseCoins}
              onChange={(e) =>
                setForm({ ...form, baseCoins: parseInt(e.target.value) || 0 })
              }
              min={1}
              max={1000}
              required
            />
          </div>
          <div>
            <label className="text-text-secondary text-xs mb-1 block">
              {dict.bonusCoins || "Bonus-Münzen"}
            </label>
            <input
              type="number"
              className={inputClass}
              value={form.bonusCoins}
              onChange={(e) =>
                setForm({ ...form, bonusCoins: parseInt(e.target.value) || 0 })
              }
              min={0}
            />
          </div>
          <div>
            <label className="text-text-secondary text-xs mb-1 block">
              {dict.priceCents || "Preis (Cent)"}
            </label>
            <input
              type="number"
              className={inputClass}
              value={form.priceEurCents}
              onChange={(e) =>
                setForm({
                  ...form,
                  priceEurCents: parseInt(e.target.value) || 0,
                })
              }
              min={100}
              required
            />
            <span className="text-text-muted text-xs mt-0.5 block">
              = {(form.priceEurCents / 100).toFixed(2)} €
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-text-secondary text-xs mb-1 block">
              {dict.icon || "Icon"} (Emoji)
            </label>
            <input
              className={inputClass}
              value={form.icon}
              onChange={(e) => setForm({ ...form, icon: e.target.value })}
              placeholder="🥇"
            />
          </div>
          <div>
            <label className="text-text-secondary text-xs mb-1 block">
              {dict.sortOrder || "Reihenfolge"}
            </label>
            <input
              type="number"
              className={inputClass}
              value={form.sortOrder}
              onChange={(e) =>
                setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })
              }
              min={0}
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) =>
                  setForm({ ...form, isActive: e.target.checked })
                }
                className="accent-pa-green"
              />
              <span className="text-text-secondary text-sm">
                {dict.active || "Aktiv"}
              </span>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-text-secondary text-xs mb-1 block">
              Highlight (DE)
            </label>
            <input
              className={inputClass}
              value={form.highlightDe}
              onChange={(e) =>
                setForm({ ...form, highlightDe: e.target.value })
              }
              placeholder="Beliebt!"
            />
          </div>
          <div>
            <label className="text-text-secondary text-xs mb-1 block">
              Highlight (EN)
            </label>
            <input
              className={inputClass}
              value={form.highlightEn}
              onChange={(e) =>
                setForm({ ...form, highlightEn: e.target.value })
              }
              placeholder="Popular!"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-text-secondary hover:text-white"
          >
            {dict.cancel || "Abbrechen"}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="bg-pa-green text-bg font-bold text-sm px-6 py-2 rounded-lg hover:bg-pa-green-hover transition-colors disabled:opacity-50"
          >
            {loading
              ? dict.saving || "Speichern..."
              : editData
                ? dict.save || "Speichern"
                : dict.create || "Erstellen"}
          </button>
        </div>
      </form>
    </div>
  );
}
