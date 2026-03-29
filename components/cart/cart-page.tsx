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
  ChevronDown,
  X,
  Minus,
  Plus,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { ReservationConsentModal } from "./reservation-consent-modal";
import { AddressAutocomplete } from "./address-autocomplete";

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
  const [converting, setConverting] = useState(false);
  const [convertDialog, setConvertDialog] = useState<{
    itemIds: string[];
    cardName: string;
    coinsPer: number;
    quantity: number;
  } | null>(null);
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
  const [consentAccepted, setConsentAccepted] = useState(() => {
    try { return sessionStorage.getItem("cart_consent") === "1"; } catch { return false; }
  });
  const [countryOpen, setCountryOpen] = useState(false);

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
      })
      .catch(() => {});
  }, [fetchCart]);

  // Show consent modal once when cart has items
  useEffect(() => {
    if (items.length > 0 && !consentAccepted && !loading) {
      setShowConsent(true);
    }
  }, [items.length, consentAccepted, loading]);

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

  function openConvertDialog(itemIds: string[], cardName: string, coinsPer: number) {
    setConvertDialog({ itemIds, cardName, coinsPer, quantity: itemIds.length });
  }

  async function handleConvertConfirm() {
    if (!convertDialog) return;
    setConverting(true);
    let totalConverted = 0;
    const toConvert = convertDialog.itemIds.slice(0, convertDialog.quantity);
    try {
      for (const id of toConvert) {
        const res = await fetch(`/api/cart/${id}`, { method: "DELETE" });
        const data = await res.json();
        if (data.success) totalConverted += data.convertedCoins;
      }
      if (totalConverted > 0) {
        toast({
          type: "success",
          title: dict["converted"] ?? "Umgewandelt",
          message: (dict["coinsCredited"] ?? "{coins} Coins gutgeschrieben").replace("{coins}", String(totalConverted)),
        });
      }
      fetchCart();
    } catch {
      toast({
        type: "error",
        title: "Error",
        message: dict["convertFailed"] ?? "Umwandlung fehlgeschlagen",
      });
    } finally {
      setConverting(false);
      setConvertDialog(null);
    }
  }

  async function handleCheckout() {
    if (!address.name || !address.street || !address.city || !address.zip) {
      toast({
        type: "error",
        title: dict["addressIncomplete"] ?? "Adresse unvollständig",
        message: dict["fillAllFields"] ?? "Bitte fülle alle Adressfelder aus.",
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
            title: dict["orderPlaced"] ?? "Bestellung aufgegeben!",
            message: `${dict["orderNumber"] ?? "Bestellung"}: ${data.orderNumber}`,
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
        message: dict["checkoutFailed"] ?? "Bestellung fehlgeschlagen",
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
          {dict["emptyCart"] ?? "Dein Warenkorb ist leer"}
        </p>
        <a
          href={`/${lang}/packs`}
          className="inline-flex items-center gap-2 rounded-lg bg-pa-green px-4 py-2 text-sm font-medium text-black hover:bg-pa-green/90"
        >
          <Package className="h-4 w-4" />
          {dict["openPacks"] ?? "Packs öffnen"}
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
              {dict["timerWarning"] ?? "Reservierte Karten werden nach Ablauf des Timers automatisch in Coins umgewandelt."}
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

        {(() => {
          // Group items by card ID
          const groups = new Map<string, { items: CartItem[]; card: CartItem["card"]; rarity: string; conversionValue: number }>();
          for (const item of items) {
            const key = item.card?._id ?? item._id;
            const existing = groups.get(key);
            if (existing) {
              existing.items.push(item);
            } else {
              groups.set(key, { items: [item], card: item.card, rarity: item.rarity, conversionValue: item.conversionValue });
            }
          }
          return Array.from(groups.entries()).map(([key, group]) => (
            <div
              key={key}
              className="flex items-center gap-4 rounded-lg border border-border bg-card p-3"
            >
              <div className="relative h-16 w-12 flex-shrink-0 overflow-hidden rounded bg-white/5">
                {group.card?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={group.card.image}
                    alt={group.card.name ?? ""}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-text-muted">
                    ?
                  </div>
                )}
                {group.items.length > 1 && (
                  <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-pa-green px-1 text-[10px] font-bold text-black">
                    {group.items.length}x
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text-primary">
                  {group.card?.name ?? "Unknown"}
                </p>
                <p className="text-xs text-text-muted">
                  {group.rarity} — {group.conversionValue * group.items.length} Coins
                  {group.items.length > 1 && (
                    <span className="text-text-disabled"> ({group.items.length}x {group.conversionValue})</span>
                  )}
                </p>
              </div>
              <button
                onClick={() => openConvertDialog(
                  group.items.map((i) => i._id),
                  group.card?.name ?? "Unknown",
                  group.conversionValue
                )}
                className="flex-shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-white/5"
              >
                {dict["toCoins"] ?? "In Münzen umwandeln"}
              </button>
            </div>
          ));
        })()}
      </div>

      {/* Checkout sidebar */}
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold text-text-primary">
            {dict["shippingAddress"] ?? "Versandadresse"}
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
            <AddressAutocomplete
              value={address.street}
              onChange={(street) => setAddress((a) => ({ ...a, street }))}
              onPlaceSelect={(place) => {
                setAddress((a) => ({ ...a, ...place }));
              }}
              placeholder={dict["placeholderStreet"] ?? "Straße"}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder={dict["placeholderZip"] ?? "PLZ"}
                value={address.zip}
                onChange={(e) =>
                  setAddress((a) => ({ ...a, zip: e.target.value }))
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
              />
              <input
                type="text"
                placeholder={dict["placeholderCity"] ?? "Stadt"}
                value={address.city}
                onChange={(e) =>
                  setAddress((a) => ({ ...a, city: e.target.value }))
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
              />
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setCountryOpen((o) => !o)}
                className="flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary"
              >
                <span>
                  {{ DE: dict["germany"] ?? "Deutschland", AT: dict["austria"] ?? "Österreich", CH: dict["switzerland"] ?? "Schweiz" }[address.country]}
                </span>
                <ChevronDown className={`h-4 w-4 text-text-muted transition-transform ${countryOpen ? "rotate-180" : ""}`} />
              </button>
              {countryOpen && (
                <ul className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
                  {([["DE", dict["germany"] ?? "Deutschland"], ["AT", dict["austria"] ?? "Österreich"], ["CH", dict["switzerland"] ?? "Schweiz"]] as const).map(([code, label]) => (
                    <li
                      key={code}
                      onMouseDown={() => {
                        setAddress((a) => ({ ...a, country: code }));
                        setCountryOpen(false);
                      }}
                      className={`cursor-pointer px-3 py-2 text-sm ${address.country === code ? "bg-surface-elevated text-text-primary" : "text-text-secondary hover:bg-surface-elevated"}`}
                    >
                      {label}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold text-text-primary">
            {dict["paymentMethod"] ?? "Zahlungsmethode"}
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
              {dict["cards"] ?? "Karten"}
            </span>
            <span className="text-text-primary">{items.length}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-text-secondary">
              {dict["shipping"] ?? "Versand"}
            </span>
            <span className="text-text-primary">
              {estimateLoading
                ? "..."
                : !shippingCost?.tierFound
                  ? dict["notAvailable"] ?? "k.A."
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
                {dict["placeOrder"] ?? "Bestellen"}
              </>
            )}
          </button>
        </div>
      </div>

      {convertDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="relative mx-4 w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-xl">
            <button
              onClick={() => setConvertDialog(null)}
              className="absolute right-3 top-3 rounded-lg p-1 text-text-muted hover:bg-white/5"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="mb-1 text-sm font-semibold text-text-primary">
              {dict["convertTitle"] ?? "In Coins umwandeln"}
            </h3>
            <p className="mb-4 text-xs text-text-muted">
              {convertDialog.cardName}
            </p>

            {convertDialog.itemIds.length > 1 && (
              <div className="mb-4 flex items-center justify-center gap-3">
                <button
                  onClick={() => setConvertDialog((d) => d ? { ...d, quantity: Math.max(1, d.quantity - 1) } : d)}
                  className="rounded-lg border border-border p-1.5 text-text-secondary hover:bg-white/5"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="min-w-12 text-center text-lg font-semibold text-text-primary">
                  {convertDialog.quantity}
                </span>
                <button
                  onClick={() => setConvertDialog((d) => d ? { ...d, quantity: Math.min(d.itemIds.length, d.quantity + 1) } : d)}
                  className="rounded-lg border border-border p-1.5 text-text-secondary hover:bg-white/5"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            )}

            <p className="mb-4 text-center text-sm text-text-secondary">
              {dict["convertConfirmText"] ?? "Du erhältst"}{" "}
              <span className="font-semibold text-amber-400">
                {convertDialog.quantity * convertDialog.coinsPer} Coins
              </span>
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setConvertDialog(null)}
                className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm text-text-secondary hover:bg-white/5"
              >
                {dict["cancel"] ?? "Abbrechen"}
              </button>
              <button
                onClick={handleConvertConfirm}
                disabled={converting}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-50"
              >
                {converting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>{dict["convertConfirm"] ?? "Umwandeln"}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showConsent && (
        <ReservationConsentModal
          dict={dict}
          onAccept={() => {
            setConsentAccepted(true);
            setShowConsent(false);
            try { sessionStorage.setItem("cart_consent", "1"); } catch {}
          }}
          onClose={() => {
            setConsentAccepted(true);
            setShowConsent(false);
            try { sessionStorage.setItem("cart_consent", "1"); } catch {}
          }}
        />
      )}
    </div>
  );
}
