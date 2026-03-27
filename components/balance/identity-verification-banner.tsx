"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";

interface IdentityVerificationBannerProps {
  dict: Record<string, string>;
}

export function IdentityVerificationBanner({
  dict,
}: IdentityVerificationBannerProps) {
  const [loading, setLoading] = useState(false);

  async function handleVerify() {
    setLoading(true);
    try {
      const res = await fetch("/api/coins/verify-identity", {
        method: "POST",
      });
      const data = await res.json();
      if (data.verificationUrl) {
        window.location.href = data.verificationUrl;
      }
    } catch {
      setLoading(false);
    }
  }

  return (
    <div className="bg-gradient-to-r from-pa-lila to-[#3a0a5c] border border-pa-green rounded-xl p-4 flex items-center gap-4">
      <ShieldCheck className="h-8 w-8 text-pa-green flex-shrink-0" />
      <div className="flex-1">
        <p className="text-white font-semibold text-sm">
          {dict.verificationRequired || "Altersverifizierung erforderlich"}
        </p>
        <p className="text-text-secondary text-xs mt-0.5">
          {dict.verificationDescription ||
            "Einmalige Verifizierung via Stripe Identity, bevor du Münzen kaufen kannst."}
        </p>
      </div>
      <button
        onClick={handleVerify}
        disabled={loading}
        className="bg-pa-green text-bg font-bold text-sm px-5 py-2 rounded-lg hover:bg-pa-green-hover transition-colors disabled:opacity-50"
      >
        {loading
          ? dict.verifying || "Wird geladen..."
          : dict.verifyNow || "Jetzt verifizieren"}
      </button>
    </div>
  );
}
