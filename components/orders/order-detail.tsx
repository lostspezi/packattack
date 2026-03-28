"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Package, Truck } from "lucide-react";

interface OrderData {
  _id: string;
  orderNumber: string;
  items: {
    cardId: {
      _id: string;
      name?: string;
      image?: string | null;
      rarity?: string;
      setName?: string;
    } | null;
    rarity: string;
  }[];
  shippingAddress: {
    name: string;
    street: string;
    city: string;
    zip: string;
    country: string;
  };
  paymentMethod: string;
  paymentStatus: string;
  shippingCostCents: number;
  fulfillments: {
    status: string;
    trackingNumber: string | null;
    shippedAt: string | null;
    itemCount: number;
  }[];
  status: string;
  createdAt: string;
}

interface OrderDetailProps {
  lang: string;
  dict: Record<string, string>;
  orderId: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending_payment: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  paid: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  processing: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  shipped: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  delivered: "bg-green-500/10 text-green-400 border-green-500/20",
  cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
};

export function OrderDetail({ lang, orderId }: OrderDetailProps) {
  const isDe = lang === "de";
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/orders/${orderId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data._id) setOrder(data);
      })
      .finally(() => setLoading(false));
  }, [orderId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-text-muted" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="py-20 text-center text-text-muted">
        {isDe ? "Bestellung nicht gefunden" : "Order not found"}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/${lang}/orders`}
          className="rounded-lg p-1 hover:bg-white/5"
        >
          <ArrowLeft className="h-5 w-5 text-text-secondary" />
        </Link>
        <div>
          <h2 className="text-xl font-bold text-text-primary">
            {order.orderNumber}
          </h2>
          <p className="text-xs text-text-muted">
            {new Date(order.createdAt).toLocaleDateString(
              isDe ? "de-DE" : "en-US",
              {
                year: "numeric",
                month: "long",
                day: "numeric",
              }
            )}
          </p>
        </div>
        <span
          className={`ml-auto inline-flex rounded border px-2 py-1 text-xs font-semibold ${STATUS_COLORS[order.status] ?? ""}`}
        >
          {order.status}
        </span>
      </div>

      {/* Shipping address */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-2 text-sm font-semibold text-text-primary">
          {isDe ? "Versandadresse" : "Shipping Address"}
        </h3>
        <p className="text-sm text-text-secondary">
          {order.shippingAddress.name}
          <br />
          {order.shippingAddress.street}
          <br />
          {order.shippingAddress.zip} {order.shippingAddress.city}
          <br />
          {order.shippingAddress.country}
        </p>
      </div>

      {/* Fulfillments */}
      {order.fulfillments.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">
            {isDe ? "Versandstatus" : "Shipping Status"}
          </h3>
          {order.fulfillments.map((f, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
            >
              <Truck className="h-5 w-5 text-text-muted" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[f.status] ?? ""}`}
                  >
                    {f.status}
                  </span>
                  <span className="text-xs text-text-muted">
                    {f.itemCount} {isDe ? "Karten" : "cards"}
                  </span>
                </div>
                {f.trackingNumber && (
                  <p className="mt-1 text-xs text-text-secondary">
                    Tracking: {f.trackingNumber}
                  </p>
                )}
                {f.shippedAt && (
                  <p className="text-xs text-text-muted">
                    {isDe ? "Versendet am" : "Shipped"}{" "}
                    {new Date(f.shippedAt).toLocaleDateString(
                      isDe ? "de-DE" : "en-US"
                    )}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cards */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-text-primary">
          {isDe ? "Karten" : "Cards"} ({order.items.length})
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {order.items.map((item, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-lg border border-border bg-card"
            >
              <div className="aspect-[2/3] bg-white/5">
                {item.cardId?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.cardId.image}
                    alt={item.cardId.name ?? ""}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-text-muted">
                    <Package className="h-8 w-8" />
                  </div>
                )}
              </div>
              <div className="p-2">
                <p className="truncate text-xs font-medium text-text-primary">
                  {item.cardId?.name ?? "Unknown"}
                </p>
                <p className="text-[10px] text-text-muted">{item.rarity}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Payment info */}
      <div className="rounded-lg border border-border bg-card p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-text-secondary">
            {isDe ? "Zahlungsmethode" : "Payment"}
          </span>
          <span className="text-text-primary">
            {order.paymentMethod === "coins" ? "Coins" : "Stripe"}
          </span>
        </div>
        <div className="mt-1 flex justify-between">
          <span className="text-text-secondary">
            {isDe ? "Versandkosten" : "Shipping"}
          </span>
          <span className="text-text-primary">
            {(order.shippingCostCents / 100).toFixed(2)} €
          </span>
        </div>
      </div>
    </div>
  );
}
