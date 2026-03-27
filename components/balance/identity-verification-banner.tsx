"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { usePathname } from "next/navigation";

interface IdentityVerificationBannerProps {
  dict: Record<string, string>;
}

export function IdentityVerificationBanner({
  dict,
}: IdentityVerificationBannerProps) {
  const [loading, setLoading] = useState(false);
  const pathname = usePathname();
  const lang = pathname.split("/")[1] || "de";

  async function handleVerify() {
    setLoading(true);
    try {
      const res = await fetch("/api/coins/verify-identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang }),
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
    <div className="bg-gradient-to-r from-pa-lila/20 to-white/2 border border-pa-green/20 rounded-[14px] p-4 flex items-center gap-4">
      <ShieldCheck className="h-8 w-8 text-pa-green flex-shrink-0" />
      <div className="flex-1">
        <p className="text-text-primary font-semibold text-sm">
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
