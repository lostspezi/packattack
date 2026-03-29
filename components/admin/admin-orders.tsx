"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Package } from "lucide-react";

interface AdminOrder {
  _id: string;
  orderNumber: string;
  userId: { name?: string; username?: string; email?: string } | null;
  items: unknown[];
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  createdAt: string;
}

const STATUSES = ["", "pending_payment", "paid", "processing", "shipped", "delivered", "cancelled"];

const STATUS_COLORS: Record<string, string> = {
  pending_payment: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  paid: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  processing: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  shipped: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  delivered: "bg-green-500/10 text-green-400 border-green-500/20",
  cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
};

export function AdminOrders({ lang, dict }: { lang: string; dict: Record<string, string> }) {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/admin/orders?${params}`);
      const data = await res.json();
      setOrders(data.orders || []);
      setTotalPages(data.totalPages || 1);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === s ? "bg-pa-green/15 text-pa-green" : "bg-white/4 text-text-muted hover:text-text-primary"
            }`}
          >
            {s || (dict["orders_filterAll"] ?? "Alle")}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-text-muted" /></div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20">
          <Package className="h-16 w-16 text-text-muted" />
          <p className="text-text-secondary">{dict["orders_noOrders"] ?? "Keine Bestellungen"}</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-white/2">
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">#</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">{dict["orders_user"] ?? "Benutzer"}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">{dict["orders_payment"] ?? "Zahlung"}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">{dict["orders_cards"] ?? "Karten"}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">{dict["orders_date"] ?? "Datum"}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o._id} className="border-b border-border last:border-0 hover:bg-white/2">
                    <td className="px-4 py-3 text-text-primary font-medium">{o.orderNumber}</td>
                    <td className="px-4 py-3 text-text-secondary">{o.userId?.name || o.userId?.username || o.userId?.email || "-"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[o.status] ?? "bg-white/5 text-text-muted border-border"}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{o.paymentMethod}</td>
                    <td className="px-4 py-3 text-text-secondary">{o.items.length}</td>
                    <td className="px-4 py-3 text-text-muted text-xs">{new Date(o.createdAt).toLocaleDateString(lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary disabled:opacity-30">{dict["orders_previous"] ?? "Zurück"}</button>
              <span className="text-xs text-text-muted">{page} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary disabled:opacity-30">{dict["orders_next"] ?? "Weiter"}</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
