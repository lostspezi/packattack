"use client";

import { useState, useEffect, useCallback } from "react";
import { Coins, Zap } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { IdentityVerificationBanner } from "./identity-verification-banner";
import { PackageCard } from "./package-card";
import { PurchaseHistory } from "./purchase-history";
import { CoinChestAnimation } from "./coin-chest-animation";
import { CheckoutConfirmationModal } from "./checkout-confirmation-modal";
import { useToast } from "@/components/ui/toast";

interface CoinPackageData {
  _id: string;
  name: { de: string; en: string };
  baseCoins: number;
  bonusCoins: number;
  priceEurCents: number;
  icon: string | null;
  highlightLabel: { de: string; en: string } | null;
}

interface BalancePageProps {
  lang: string;
  dict: Record<string, string>;
}

export function BalancePage({ lang, dict }: BalancePageProps) {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [packages, setPackages] = useState<CoinPackageData[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [identityVerified, setIdentityVerified] = useState<boolean | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<CoinPackageData | null>(null);
  const [showAnimation, setShowAnimation] = useState(false);
  const [animationCoins, setAnimationCoins] = useState(0);

  // Fetch initial data
  useEffect(() => {
    Promise.all([
      fetch("/api/coins/packages").then((r) => r.json()),
      fetch("/api/profile").then((r) => r.json()),
      fetch("/api/coins/verify-identity/status").then((r) => r.json()),
    ]).then(([pkgs, profile, identity]) => {
      setPackages(pkgs || []);
      setBalance(profile?.coins || 0);
      setIdentityVerified(identity?.identityVerified ?? false);
    });
  }, []);

  // Handle success return from Stripe Checkout
  useEffect(() => {
    const success = searchParams.get("success");
    const sessionId = searchParams.get("session_id");
    const canceled = searchParams.get("canceled");

    if (canceled) {
      toast({ type: "info", title: dict.paymentCanceled || "Zahlung abgebrochen" });
      return;
    }

    if (success && sessionId) {
      pollPurchaseStatus(sessionId);
    }
  }, [searchParams]);

  const pollPurchaseStatus = useCallback(
    async (sessionId: string) => {
      const maxAttempts = 10;
      for (let i = 0; i < maxAttempts; i++) {
        const res = await fetch(
          `/api/coins/purchases?sessionId=${sessionId}`
        );
        const data = await res.json();
        if (data.purchase?.status === "completed") {
          setAnimationCoins(data.purchase.coinsGranted);
          setShowAnimation(true);
          // Refresh balance after animation
          const profileRes = await fetch("/api/profile");
          const profile = await profileRes.json();
          setBalance(profile?.coins || 0);
          // Dispatch event for header coin balance refresh
          window.dispatchEvent(new CustomEvent("coin-balance-refresh"));
          return;
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
      toast({
        type: "info",
        title: dict.paymentProcessing || "Zahlung wird verarbeitet...",
        message:
          dict.paymentProcessingDesc ||
          "Deine Münzen werden in Kürze gutgeschrieben.",
      });
    },
    [toast, dict]
  );

  function handleSelectPackage(packageId: string) {
    if (!identityVerified) {
      toast({
        type: "warning",
        title: dict.verificationNeeded || "Verifizierung erforderlich",
        message:
          dict.verificationNeededDesc ||
          "Bitte verifiziere zuerst dein Alter.",
      });
      return;
    }

    // Show confirmation modal with Widerrufsrecht consent
    const pkg = packages.find((p) => p._id === packageId);
    if (pkg) setSelectedPackage(pkg);
  }

  async function handleConfirmCheckout() {
    if (!selectedPackage) return;
    setCheckoutLoading(selectedPackage._id);
    try {
      const res = await fetch("/api/coins/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageId: selectedPackage._id,
          withdrawalConsent: true,
        }),
      });
      const data = await res.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        toast({
          type: "error",
          title: dict.checkoutError || "Fehler",
          message: data.error || "Checkout konnte nicht erstellt werden.",
        });
      }
    } catch {
      toast({
        type: "error",
        title: dict.checkoutError || "Fehler",
        message: "Ein unerwarteter Fehler ist aufgetreten.",
      });
    } finally {
      setCheckoutLoading(null);
      setSelectedPackage(null);
    }
  }

  return (
    <div className="space-y-8">
      {/* Animation overlay */}
      {showAnimation && (
        <CoinChestAnimation
          coinsGranted={animationCoins}
          onClose={() => setShowAnimation(false)}
        />
      )}

      {/* Checkout confirmation modal (Widerrufsrecht consent) */}
      {selectedPackage && (
        <CheckoutConfirmationModal
          pkg={selectedPackage}
          lang={lang}
          loading={checkoutLoading === selectedPackage._id}
          onConfirm={handleConfirmCheckout}
          onCancel={() => setSelectedPackage(null)}
        />
      )}

      {/* Identity verification banner */}
      {identityVerified === false && (
        <IdentityVerificationBanner dict={dict} />
      )}

      {/* Balance display */}
      <div className="text-center py-4">
        <div className="text-text-secondary text-xs uppercase tracking-widest">
          {dict.yourBalance || "Dein Guthaben"}
        </div>
        <div className="text-5xl font-extrabold text-pa-green my-2 tabular-nums flex items-center justify-center gap-3">
          <Coins className="h-10 w-10" />
          {balance.toLocaleString("de-DE")}
        </div>
        <div className="text-text-muted text-sm">
          {dict.coins || "Münzen"} •{" "}
          {dict.equivalent || "entspricht"}{" "}
          {balance.toLocaleString("de-DE", {
            minimumFractionDigits: 2,
          })}{" "}
          €
        </div>
      </div>

      {/* Packages grid */}
      <div>
        <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
          <Zap className="h-5 w-5 text-pa-green" />
          {dict.topUp || "Münzen aufladen"}
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {packages.map((pkg) => (
            <PackageCard
              key={pkg._id}
              pkg={pkg}
              lang={lang}
              onSelect={handleSelectPackage}
              disabled={checkoutLoading === pkg._id}
            />
          ))}
        </div>
      </div>

      {/* Transaction history */}
      <div>
        <h3 className="text-lg font-bold text-white mb-4">
          {dict.transactionHistory || "Transaktionshistorie"}
        </h3>
        <PurchaseHistory lang={lang} dict={dict} />
      </div>
    </div>
  );
}
