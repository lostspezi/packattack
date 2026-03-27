"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Edit2, Trash2, ArrowUpDown } from "lucide-react";
import { CoinPackageForm } from "./coin-package-form";
import { useToast } from "@/components/ui/toast";

interface CoinPackageData {
  _id: string;
  name: { de: string; en: string };
  baseCoins: number;
  bonusCoins: number;
  priceEurCents: number;
  isActive: boolean;
  sortOrder: number;
  icon: string | null;
  highlightLabel: { de: string; en: string } | null;
  stripePriceId: string | null;
}

interface CoinPackageManagerProps {
  lang: string;
  dict: Record<string, string>;
}

export function CoinPackageManager({ lang, dict }: CoinPackageManagerProps) {
  const { toast } = useToast();
  const [packages, setPackages] = useState<CoinPackageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPackage, setEditingPackage] = useState<CoinPackageData | null>(
    null
  );

  const fetchPackages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/coin-packages");
      const data = await res.json();
      setPackages(Array.isArray(data) ? data : []);
    } catch {
      setPackages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  async function handleDelete(id: string) {
    if (!confirm(dict.confirmDeactivate || "Paket wirklich deaktivieren?"))
      return;

    const res = await fetch(`/api/admin/coin-packages/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast({
        type: "success",
        title: dict.packageDeactivated || "Paket deaktiviert",
      });
      fetchPackages();
    }
  }

  function handleEdit(pkg: CoinPackageData) {
    setEditingPackage(pkg);
    setShowForm(true);
  }

  function handleFormClose() {
    setShowForm(false);
    setEditingPackage(null);
    fetchPackages();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => {
            setEditingPackage(null);
            setShowForm(true);
          }}
          className="bg-pa-green text-bg font-bold text-sm px-4 py-2 rounded-lg hover:bg-pa-green-hover transition-colors flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          {dict.newPackage || "Neues Paket"}
        </button>
      </div>

      {showForm && (
        <CoinPackageForm
          lang={lang}
          dict={dict}
          editData={editingPackage}
          onClose={handleFormClose}
        />
      )}

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-text-secondary text-xs uppercase">
              <th className="text-left p-3">
                <div className="flex items-center gap-1">
                  <ArrowUpDown className="h-3 w-3" /> {dict.order || "#"}
                </div>
              </th>
              <th className="text-left p-3">{dict.name || "Name"}</th>
              <th className="text-right p-3">{dict.coins || "Münzen"}</th>
              <th className="text-right p-3">{dict.bonus || "Bonus"}</th>
              <th className="text-right p-3">{dict.price || "Preis"}</th>
              <th className="text-center p-3">{dict.status || "Status"}</th>
              <th className="text-center p-3">{dict.stripe || "Stripe"}</th>
              <th className="text-right p-3">{dict.actions || "Aktionen"}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-text-secondary">
                  {dict.loading || "Laden..."}
                </td>
              </tr>
            ) : packages.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-text-secondary">
                  {dict.noPackages || "Keine Pakete vorhanden."}
                </td>
              </tr>
            ) : (
              packages.map((pkg) => (
                <tr key={pkg._id} className="border-b border-border last:border-0">
                  <td className="p-3 text-text-secondary">{pkg.sortOrder}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span>{pkg.icon || "🪙"}</span>
                      <span className="text-white font-medium">
                        {lang === "en" ? pkg.name.en : pkg.name.de}
                      </span>
                    </div>
                  </td>
                  <td className="p-3 text-right text-white font-mono">
                    {pkg.baseCoins}
                  </td>
                  <td className="p-3 text-right text-pa-green font-mono">
                    {pkg.bonusCoins > 0 ? `+${pkg.bonusCoins}` : "—"}
                  </td>
                  <td className="p-3 text-right text-white font-mono">
                    {(pkg.priceEurCents / 100).toFixed(2)} €
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        pkg.isActive
                          ? "bg-pa-green/10 text-pa-green"
                          : "bg-error/10 text-error"
                      }`}
                    >
                      {pkg.isActive
                        ? dict.active || "Aktiv"
                        : dict.inactive || "Inaktiv"}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`text-xs ${
                        pkg.stripePriceId ? "text-pa-green" : "text-warning"
                      }`}
                    >
                      {pkg.stripePriceId ? "✓" : "⚠"}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleEdit(pkg)}
                        className="text-text-secondary hover:text-white transition-colors"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      {pkg.isActive && (
                        <button
                          onClick={() => handleDelete(pkg._id)}
                          className="text-text-secondary hover:text-error transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
