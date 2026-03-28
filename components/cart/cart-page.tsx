"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ShoppingCart,
  Clock,
  ArrowRight,
  Coins,
  CreditCard,
  Package,
  Loader2,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { ReservationConsentModal } from "./reservation-consent-modal";

interface CartItem {
  _id: string;
  card: {
    _id: string;
    name?: string;
    image?: string | null;
    rarity?: string;
    setName?: string;
  } | null;
  box: {
    _id: string;
    name?: { de: string; en: string };
    game?: string;
  } | null;
  rarity: string;
  conversionValue: number;
  expiresAt: string;
  remainingSeconds: number;
  createdAt: string;
}

interface CartPageProps {
  lang: string;
  dict: Record<string, string>;
}

export function CartPage({ lang, dict }: CartPageProps) {
  const { toast } = useToast();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // Address form
  const [address, setAddress] = useState({
    name: "",
    street: "",
    city: "",
    zip: "",
    country: "DE" as "DE" | "AT" | "CH",
  });
  const [paymentMethod, setPaymentMethod] = useState<"coins" | "stripe">(
    "coins"
  );
  const [shippingCost, setShippingCost] = useState<{
    costCents: number;
    costCoins: number;
    tierFound: boolean;
  } | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);

  // Single cart-wide countdown (all items share the same expiry)
  const [cartCountdown, setCartCountdown] = useState(0);

  const fetchCart = useCallback(async () => {
    try {
      const res = await fetch("/api/cart");
      const data = await res.json();
      if (data.items) {
        setItems(data.items);
        // All items share the same expiresAt — use the minimum remaining
        const minRemaining = data.items.length > 0
          ? Math.min(...data.items.map((i: CartItem) => i.remainingSeconds))
          : 0;
        setCartCountdown(minRemaining);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Load cart and pre-fill address
  useEffect(() => {
    fetchCart();
    fetch("/api/account/profile")
      .then((r) => r.json())
      .then((profile) => {
        if (profile?.shippingAddress) {
          const sa = profile.shippingAddress;
          setAddress({
            name: sa.name || "",
            street: sa.street || "",
            city: sa.city || "",
            zip: sa.zip || "",
            country: sa.country || "DE",
          });
        }
        if (profile?.reservationRulesAccepted) {
          setConsentAccepted(true);
        }
      })
      .catch(() => {});
  }, [fetchCart]);

  // Cart-wide countdown ticker
  useEffect(() => {
    if (cartCountdown <= 0) return;
    const interval = setInterval(() => {
      setCartCountdown((prev) => {
        const next = Math.max(0, prev - 1);
        if (next === 0) fetchCart();
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [cartCountdown, fetchCart]);

  // Fetch shipping estimate when country or items change
  useEffect(() => {
    if (items.length === 0) return;
    setEstimateLoading(true);
    fetch("/api/cart/shipping-estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country: address.country }),
    })
      .then((r) => r.json())
      .then((data) => setShippingCost(data))
      .catch(() => {})
      .finally(() => setEstimateLoading(false));
  }, [address.country, items.length]);

  async function handleConvert(itemId: string) {
    setConvertingId(itemId);
    try {
      const res = await fetch(`/api/cart/${itemId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast({
          type: "success",
          title: dict["converted"] ?? "Converted",
          message: (dict["coinsCredited"] ?? "{coins} coins credited").replace("{coins}", String(data.convertedCoins)),
        });
        fetchCart();
      } else {
        toast({ type: "error", title: "Error", message: data.error });
      }
    } catch {
      toast({
        type: "error",
        title: "Error",
        message: dict["convertFailed"] ?? "Failed to convert",
      });
    } finally {
      setConvertingId(null);
    }
  }

  async function handleCheckout() {
    if (!consentAccepted) {
      setShowConsent(true);
      return;
    }

    if (!address.name || !address.street || !address.city || !address.zip) {
      toast({
        type: "error",
        title: dict["addressIncomplete"] ?? "Address incomplete",
        message: dict["fillAllFields"] ?? "Please fill in all address fields.",
      });
      return;
    }

    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/cart/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod, address, lang }),
      });
      const data = await res.json();

      if (data.success) {
        if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
        } else {
          toast({
            type: "success",
            title: dict["orderPlaced"] ?? "Order placed!",
            message: `${dict["orderNumber"] ?? "Order"}: ${data.orderNumber}`,
          });
          window.location.href = `/${lang}/orders/${data.orderId}`;
        }
      } else {
        toast({ type: "error", title: "Error", message: data.error });
      }
    } catch {
      toast({
        type: "error",
        title: "Error",
        message: dict["checkoutFailed"] ?? "Checkout failed",
      });
    } finally {
      setCheckoutLoading(false);
    }
  }

  function formatTime(seconds: number) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-text-muted" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <ShoppingCart className="h-16 w-16 text-text-muted" />
        <p className="text-lg text-text-secondary">
          {dict["emptyCart"] ?? "Your cart is empty"}
        </p>
        <a
          href={`/${lang}/packs`}
          className="inline-flex items-center gap-2 rounded-lg bg-pa-green px-4 py-2 text-sm font-medium text-black hover:bg-pa-green/90"
        >
          <Package className="h-4 w-4" />
          {dict["openPacks"] ?? "Open Packs"}
        </a>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      {/* Cart items */}
      <div className="space-y-3">
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-200">
          <div className="flex items-center justify-between">
            <span>
              <Clock className="mr-2 inline h-4 w-4" />
              {dict["timerWarning"] ?? "Reserved cards will be automatically converted to coins after the timer expires."}
            </span>
            <span
              className={[
                "ml-4 whitespace-nowrap font-mono text-base font-semibold",
                cartCountdown < 3600 ? "text-amber-400" : "text-amber-200",
              ].join(" ")}
            >
              {formatTime(cartCountdown)}
            </span>
          </div>
        </div>

        {items.map((item) => (
          <div
            key={item._id}
            className="flex items-center gap-4 rounded-lg border border-border bg-card p-3"
          >
            <div className="h-16 w-12 flex-shrink-0 overflow-hidden rounded bg-white/5">
              {item.card?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.card.image}
                  alt={item.card.name ?? ""}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-text-muted">
                  ?
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text-primary">
                {item.card?.name ?? "Unknown"}
              </p>
              <p className="text-xs text-text-muted">
                {item.rarity} — {item.conversionValue} Coins
              </p>
            </div>
            <button
              onClick={() => handleConvert(item._id)}
              disabled={convertingId === item._id}
              className="flex-shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-white/5 disabled:opacity-50"
            >
              {convertingId === item._id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>{dict["toCoins"] ?? "To Coins"}</>
              )}
            </button>
          </div>
        ))}
      </div>

      {/* Checkout sidebar */}
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold text-text-primary">
            {dict["shippingAddress"] ?? "Shipping Address"}
          </h3>
          <div className="space-y-2">
            <input
              type="text"
              placeholder={dict["placeholderName"] ?? "Name"}
              value={address.name}
              onChange={(e) =>
                setAddress((a) => ({ ...a, name: e.target.value }))
              }
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
            />
            <input
              type="text"
              placeholder={dict["placeholderStreet"] ?? "Street"}
              value={address.street}
              onChange={(e) =>
                setAddress((a) => ({ ...a, street: e.target.value }))
              }
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder={dict["placeholderZip"] ?? "Zip"}
                value={address.zip}
                onChange={(e) =>
                  setAddress((a) => ({ ...a, zip: e.target.value }))
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
              />
              <input
                type="text"
                placeholder={dict["placeholderCity"] ?? "City"}
                value={address.city}
                onChange={(e) =>
                  setAddress((a) => ({ ...a, city: e.target.value }))
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
              />
            </div>
            <select
              value={address.country}
              onChange={(e) =>
                setAddress((a) => ({
                  ...a,
                  country: e.target.value as "DE" | "AT" | "CH",
                }))
              }
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary"
            >
              <option value="DE">{dict["germany"] ?? "Germany"}</option>
              <option value="AT">{dict["austria"] ?? "Austria"}</option>
              <option value="CH">{dict["switzerland"] ?? "Switzerland"}</option>
            </select>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold text-text-primary">
            {dict["paymentMethod"] ?? "Payment Method"}
          </h3>
          <div className="space-y-2">
            <label
              className={[
                "flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm",
                paymentMethod === "coins"
                  ? "border-pa-green bg-pa-green/5"
                  : "border-border",
              ].join(" ")}
            >
              <input
                type="radio"
                name="payment"
                checked={paymentMethod === "coins"}
                onChange={() => setPaymentMethod("coins")}
                className="accent-pa-green"
              />
              <Coins className="h-4 w-4 text-amber-400" />
              <span className="text-text-primary">Coins</span>
              {shippingCost?.tierFound && (
                <span className="ml-auto text-text-muted">
                  {shippingCost.costCoins} Coins
                </span>
              )}
            </label>
            <label
              className={[
                "flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm",
                paymentMethod === "stripe"
                  ? "border-pa-green bg-pa-green/5"
                  : "border-border",
              ].join(" ")}
            >
              <input
                type="radio"
                name="payment"
                checked={paymentMethod === "stripe"}
                onChange={() => setPaymentMethod("stripe")}
                className="accent-pa-green"
              />
              <CreditCard className="h-4 w-4 text-blue-400" />
              <span className="text-text-primary">Stripe</span>
              {shippingCost?.tierFound && (
                <span className="ml-auto text-text-muted">
                  {(shippingCost.costCents / 100).toFixed(2)} €
                </span>
              )}
            </label>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">
              {dict["cards"] ?? "Cards"}
            </span>
            <span className="text-text-primary">{items.length}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-text-secondary">
              {dict["shipping"] ?? "Shipping"}
            </span>
            <span className="text-text-primary">
              {estimateLoading
                ? "..."
                : !shippingCost?.tierFound
                  ? dict["notAvailable"] ?? "N/A"
                  : paymentMethod === "coins"
                    ? `${shippingCost.costCoins} Coins`
                    : `${(shippingCost.costCents / 100).toFixed(2)} €`}
            </span>
          </div>
          <hr className="my-3 border-border" />
          <button
            onClick={handleCheckout}
            disabled={checkoutLoading || !shippingCost?.tierFound}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-pa-green px-4 py-3 text-sm font-semibold text-black hover:bg-pa-green/90 disabled:opacity-50"
          >
            {checkoutLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <ArrowRight className="h-4 w-4" />
                {dict["placeOrder"] ?? "Place Order"}
              </>
            )}
          </button>
        </div>
      </div>

      {showConsent && (
        <ReservationConsentModal
          dict={dict}
          onAccept={() => {
            setConsentAccepted(true);
            setShowConsent(false);
            handleCheckout();
          }}
          onClose={() => setShowConsent(false)}
        />
      )}
    </div>
  );
}
