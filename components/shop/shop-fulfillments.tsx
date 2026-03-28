"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Package, Truck, CheckCircle2, Clock } from "lucide-react";
import { useToast } from "@/components/ui/toast";

interface FulfillmentOrder {
  _id: string;
  orderNumber: string;
  user: { name?: string; username?: string } | null;
  shippingAddress: { name: string; street: string; city: string; zip: string; country: string };
  fulfillment: { status: string; trackingNumber: string | null; items: unknown[] } | null;
  items: unknown[];
  createdAt: string;
}

export function ShopFulfillments({ lang, dict }: { lang: string; dict: Record<string, string> }) {
  const { toast } = useToast();
  const [orders, setOrders] = useState<FulfillmentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [trackingInputs, setTrackingInputs] = useState<Record<string, string>>({});

  const statuses = ["", "pending", "processing", "shipped", "delivered"] as const;

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/shop/fulfillments?${params}`);
      const data = await res.json();
      setOrders(data.orders || []);
      setTotalPages(data.totalPages || 1);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  async function handleAction(orderId: string, status: string) {
    setActionLoading(orderId);
    try {
      const body: Record<string, string> = { status };
      if (status === "shipped" && trackingInputs[orderId]) {
        body.trackingNumber = trackingInputs[orderId];
      }
      const res = await fetch(`/api/shop/fulfillments/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        toast({ type: "success", title: dict["statusUpdated"] ?? "Status updated" });
        fetchOrders();
      } else {
        toast({ type: "error", title: data.error || "Error" });
      }
    } catch {
      toast({ type: "error", title: "Network error" });
    } finally {
      setActionLoading(null);
    }
  }

  function statusLabel(s: string): string {
    if (!s) return dict["filterAll"] ?? "All";
    return dict[`status_${s}`] ?? s;
  }

  return (
    <div className="space-y-4">
      {/* Status tabs */}
      <div className="flex gap-2 overflow-x-auto">
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === s ? "bg-pa-green/15 text-pa-green" : "bg-white/4 text-text-muted hover:text-text-primary"
            }`}
          >
            {statusLabel(s)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-text-muted" /></div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <Package className="h-16 w-16 text-text-muted" />
          <p className="text-text-secondary">{dict["noOrders"] ?? "No orders"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const f = order.fulfillment;
            return (
              <div key={order._id} className="rounded-lg border border-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-text-primary">{order.orderNumber}</span>
                    <span className="ml-2 text-xs text-text-muted">{order.user?.name || order.user?.username || "User"}</span>
                  </div>
                  <span className="text-xs text-text-muted">{new Date(order.createdAt).toLocaleDateString(lang)}</span>
                </div>

                <div className="text-xs text-text-secondary">
                  {order.shippingAddress.name}, {order.shippingAddress.street}, {order.shippingAddress.zip} {order.shippingAddress.city}, {order.shippingAddress.country}
                </div>

                <div className="flex items-center gap-2 text-xs text-text-muted">
                  <Package className="h-3.5 w-3.5" />
                  {f?.items.length ?? 0} {dict["cards"] ?? "cards"}
                  {f?.trackingNumber && (
                    <span className="ml-2">Tracking: {f.trackingNumber}</span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {f?.status === "pending" && (
                    <button
                      onClick={() => handleAction(order._id, "processing")}
                      disabled={actionLoading === order._id}
                      className="flex items-center gap-1.5 rounded-lg bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-400 hover:bg-blue-500/20 disabled:opacity-50"
                    >
                      {actionLoading === order._id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Clock className="h-3 w-3" />}
                      {dict["actionProcess"] ?? "Process"}
                    </button>
                  )}
                  {f?.status === "processing" && (
                    <>
                      <input
                        type="text"
                        placeholder="Tracking (optional)"
                        value={trackingInputs[order._id] || ""}
                        onChange={(e) => setTrackingInputs((p) => ({ ...p, [order._id]: e.target.value }))}
                        className="rounded-lg border border-border bg-background px-2 py-1 text-xs text-text-primary placeholder:text-text-muted"
                      />
                      <button
                        onClick={() => handleAction(order._id, "shipped")}
                        disabled={actionLoading === order._id}
                        className="flex items-center gap-1.5 rounded-lg bg-purple-500/10 px-3 py-1.5 text-xs font-medium text-purple-400 hover:bg-purple-500/20 disabled:opacity-50"
                      >
                        {actionLoading === order._id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Truck className="h-3 w-3" />}
                        {dict["actionShipped"] ?? "Shipped"}
                      </button>
                    </>
                  )}
                  {f?.status === "shipped" && (
                    <button
                      onClick={() => handleAction(order._id, "delivered")}
                      disabled={actionLoading === order._id}
                      className="flex items-center gap-1.5 rounded-lg bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-400 hover:bg-green-500/20 disabled:opacity-50"
                    >
                      {actionLoading === order._id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                      {dict["actionDelivered"] ?? "Delivered"}
                    </button>
                  )}
                  {f?.status === "delivered" && (
                    <span className="flex items-center gap-1.5 text-xs text-green-400">
                      <CheckCircle2 className="h-3 w-3" /> {dict["actionDelivered"] ?? "Delivered"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary disabled:opacity-30">
                {dict["previous"] ?? "Previous"}
              </button>
              <span className="text-xs text-text-muted">{page} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary disabled:opacity-30">
                {dict["next"] ?? "Next"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
