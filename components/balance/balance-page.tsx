"use client";

import { useState, useEffect } from "react";
import { Coins, Zap } from "lucide-react";
import { IdentityVerificationBanner } from "./identity-verification-banner";
import { PackageCard } from "./package-card";
import { PurchaseHistory } from "./purchase-history";
import { CheckoutConfirmationModal } from "./checkout-confirmation-modal";
import { useToast } from "@/components/ui/toast";
import { Card } from "@/components/ui/card";

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
  const { toast } = useToast();
  const [packages, setPackages] = useState<CoinPackageData[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [identityVerified, setIdentityVerified] = useState<boolean | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<CoinPackageData | null>(null);

  // Fetch initial data
  useEffect(() => {
    function fetchData() {
      Promise.all([
        fetch("/api/coins/packages").then((r) => r.json()),
        fetch("/api/profile").then((r) => r.json()),
        fetch("/api/coins/verify-identity/status").then((r) => r.json()),
      ]).then(([pkgs, profile, identity]) => {
        setPackages(pkgs || []);
        setBalance(profile?.coins || 0);
        setIdentityVerified(identity?.identityVerified ?? false);
      });
    }

    fetchData();

    // Stay in sync with header coin balance
    function handleCoinUpdate() {
      fetch("/api/profile")
        .then((r) => r.json())
        .then((data) => {
          if (data?.coins !== undefined) setBalance(data.coins);
        })
        .catch(() => {});
    }

    window.addEventListener("coin-balance-refresh", handleCoinUpdate);
    window.addEventListener("coin-balance-change", handleCoinUpdate);
    return () => {
      window.removeEventListener("coin-balance-refresh", handleCoinUpdate);
      window.removeEventListener("coin-balance-change", handleCoinUpdate);
    };
  }, []);

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
          lang,
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
    <div className="space-y-6">
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
      <Card variant="accent" className="p-6 md:p-8 text-center">
        <div className="text-text-secondary text-xs uppercase tracking-widest">
          {dict.yourBalance || "Dein Guthaben"}
        </div>
        <div className="text-5xl font-extrabold text-pa-green my-3 tabular-nums flex items-center justify-center gap-3">
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
      </Card>

      {/* Packages grid */}
      <div>
        <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-4">
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
        <h3 className="text-lg font-semibold text-text-primary mb-4">
          {dict.transactionHistory || "Transaktionshistorie"}
        </h3>
        <PurchaseHistory lang={lang} dict={dict} />
      </div>
    </div>
  );
}
