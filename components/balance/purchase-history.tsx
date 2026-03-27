"use client";

import { useState, useEffect, useCallback } from "react";
import { FileText, ChevronLeft, ChevronRight } from "lucide-react";

interface Purchase {
  _id: string;
  packageSnapshot: {
    name: { de: string; en: string };
    baseCoins: number;
    bonusCoins: number;
    priceEurCents: number;
  };
  status: string;
  coinsGranted: number;
  invoiceNumber: string | null;
  createdAt: string;
}

interface PurchaseHistoryProps {
  lang: string;
  dict: Record<string, string>;
}

export function PurchaseHistory({ lang, dict }: PurchaseHistoryProps) {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchPurchases = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/coins/purchases?page=${page}&limit=10`);
      const data = await res.json();
      setPurchases(data.purchases || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch {
      setPurchases([]);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases]);

  async function downloadInvoice(purchaseId: string, invoiceNumber: string) {
    const res = await fetch(`/api/coins/purchases/${purchaseId}/invoice`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Rechnung-${invoiceNumber}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading && purchases.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-xl p-8 text-center text-text-secondary">
        {dict.loading || "Laden..."}
      </div>
    );
  }

  if (purchases.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-xl p-8 text-center text-text-secondary">
        {dict.noPurchases || "Noch keine Käufe."}
      </div>
    );
  }

  return (
    <div>
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {purchases.map((p, i) => {
          const name =
            lang === "en"
              ? p.packageSnapshot.name.en
              : p.packageSnapshot.name.de;
          const total = p.coinsGranted || p.packageSnapshot.baseCoins + p.packageSnapshot.bonusCoins;
          const date = new Date(p.createdAt).toLocaleDateString(
            lang === "de" ? "de-DE" : "en-US",
            { day: "numeric", month: "long", year: "numeric" }
          );

          return (
            <div
              key={p._id}
              className={`flex items-center px-4 py-3 ${
                i < purchases.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="text-white text-sm font-semibold truncate">
                  {name}
                </div>
                <div className="text-text-muted text-xs mt-0.5">
                  {date} • {p.status === "completed" ? "Stripe" : p.status}
                </div>
              </div>
              <div
                className={`font-bold text-sm mr-4 ${
                  p.status === "completed"
                    ? "text-pa-green"
                    : "text-text-secondary"
                }`}
              >
                {p.status === "completed" ? `+${total} 🪙` : "—"}
              </div>
              {p.invoiceNumber && p.status === "completed" && (
                <button
                  onClick={() => downloadInvoice(p._id, p.invoiceNumber!)}
                  className="bg-surface-elevated px-3 py-1 rounded-md text-xs text-text-secondary hover:text-white transition-colors flex items-center gap-1"
                >
                  <FileText className="h-3 w-3" />
                  {dict.invoice || "Rechnung"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="text-text-secondary hover:text-white disabled:opacity-30"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-text-secondary text-sm">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="text-text-secondary hover:text-white disabled:opacity-30"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}
