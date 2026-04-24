"use client";

import { useState } from "react";
import { X, ExternalLink } from "lucide-react";

interface CheckoutConfirmationModalProps {
  pkg: {
    name: { de: string; en: string };
    baseCoins: number;
    bonusCoins: number;
    priceEurCents: number;
    icon: string | null;
  };
  lang: string;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CheckoutConfirmationModal({
  pkg,
  lang,
  loading,
  onConfirm,
  onCancel,
}: CheckoutConfirmationModalProps) {
  const [consentChecked, setConsentChecked] = useState(false);
  const name = lang === "en" ? pkg.name.en : pkg.name.de;
  const totalCoins = pkg.baseCoins + pkg.bonusCoins;
  const priceEur = (pkg.priceEurCents / 100).toFixed(2).replace(".", ",");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-surface border border-border rounded-xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold text-lg">
            {lang === "en" ? "Confirm Purchase" : "Kauf bestätigen"}
          </h3>
          <button
            onClick={onCancel}
            className="text-text-secondary hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Package summary */}
        <div className="bg-surface-elevated rounded-lg p-4 mb-4 text-center">
          <div className="text-2xl mb-1">{pkg.icon || "🪙"}</div>
          <div className="text-white font-bold">{name}</div>
          <div className="text-pa-green font-extrabold text-xl mt-1">
            {totalCoins} {lang === "en" ? "Coins" : "Münzen"}
          </div>
          <div className="text-text-secondary text-sm mt-1">{priceEur} €</div>
        </div>

        {/* Widerrufsrecht consent checkbox */}
        <label className="flex gap-3 cursor-pointer mb-4">
          <input
            type="checkbox"
            checked={consentChecked}
            onChange={(e) => setConsentChecked(e.target.checked)}
            className="accent-pa-green mt-1 shrink-0"
          />
          <span className="text-text-secondary text-xs leading-relaxed">
            {lang === "en"
              ? "I expressly agree that PACKATTACK.gg begins delivery of the digital content (Coins) immediately. I acknowledge that I lose my right of withdrawal upon complete delivery of the digital content. I have read the "
              : "Ich stimme ausdrücklich zu, dass PACKATTACK.gg sofort mit der Bereitstellung der digitalen Inhalte (Coins) beginnt. Mir ist bekannt, dass ich dadurch mein Widerrufsrecht mit vollständiger Bereitstellung der digitalen Inhalte verliere. Ich habe die "}
            <a
              href={`/${lang}/widerrufsbelehrung`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-pa-green hover:underline inline-flex items-center gap-0.5"
            >
              {lang === "en" ? "cancellation policy" : "Widerrufsbelehrung"}
              <ExternalLink className="h-3 w-3" />
            </a>
            {lang === "en" ? " ." : " zur Kenntnis genommen."}
          </span>
        </label>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 text-sm text-text-secondary border border-border rounded-lg hover:text-white hover:border-text-secondary transition-colors"
          >
            {lang === "en" ? "Cancel" : "Abbrechen"}
          </button>
          <button
            onClick={onConfirm}
            disabled={!consentChecked || loading}
            className="flex-1 bg-pa-green text-bg font-bold text-sm px-4 py-2.5 rounded-lg hover:bg-pa-green-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading
              ? lang === "en"
                ? "Redirecting..."
                : "Weiterleitung..."
              : lang === "en"
                ? "Proceed to Payment"
                : "Weiter zur Zahlung"}
          </button>
        </div>
      </div>
    </div>
  );
}
