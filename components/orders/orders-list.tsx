"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Package, Loader2, ChevronRight } from "lucide-react";

interface OrderSummary {
  _id: string;
  orderNumber: string;
  items: { cardId: unknown }[];
  status: string;
  paymentMethod: string;
  shippingCostCents: number;
  fulfillments: {
    status: string;
    trackingNumber: string | null;
    itemCount: number;
  }[];
  createdAt: string;
}

interface OrdersListProps {
  lang: string;
  dict: Record<string, string>;
}

const STATUS_COLORS: Record<string, string> = {
  pending_payment: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  paid: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  processing: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  shipped: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  delivered: "bg-green-500/10 text-green-400 border-green-500/20",
  cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
};

export function OrdersList({ lang, dict }: OrdersListProps) {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders?page=${page}&limit=20`);
      const data = await res.json();
      setOrders(data.orders || []);
      setTotalPages(data.totalPages || 1);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-text-muted" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <Package className="h-16 w-16 text-text-muted" />
        <p className="text-lg text-text-secondary">
          {dict["noOrders"] ?? "Noch keine Bestellungen"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => (
        <Link
          key={order._id}
          href={`/${lang}/orders/${order._id}`}
          className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-white/3"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-text-primary">
                {order.orderNumber}
              </span>
              <span
                className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[order.status] ?? "bg-white/5 text-text-muted border-border"}`}
              >
                {order.status}
              </span>
            </div>
            <p className="mt-1 text-xs text-text-muted">
              {order.items.length} {dict["cards"] ?? "Karten"} —{" "}
              {order.paymentMethod === "coins" ? "Coins" : "Stripe"} —{" "}
              {new Date(order.createdAt).toLocaleDateString(lang)}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 flex-shrink-0 text-text-muted" />
        </Link>
      ))}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary disabled:opacity-30"
          >
            {dict["previous"] ?? "Zurück"}
          </button>
          <span className="text-xs text-text-muted">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary disabled:opacity-30"
          >
            {dict["next"] ?? "Weiter"}
          </button>
        </div>
      )}
    </div>
  );
}
