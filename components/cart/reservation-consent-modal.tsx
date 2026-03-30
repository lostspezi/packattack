"use client";

import { Clock, AlertTriangle, Coins, X } from "lucide-react";

interface ReservationConsentModalProps {
  dict: Record<string, string>;
  onAccept: () => void;
  onClose: () => void;
}

export function ReservationConsentModal({ dict, onAccept, onClose }: ReservationConsentModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="relative mx-4 w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-xl">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-1 text-text-muted hover:bg-white/5"
        >
          <X className="h-4 w-4" />
        </button>

        <h3 className="mb-4 text-lg font-bold text-text-primary">
          {dict["consentTitle"] ?? "Reservierungsregeln"}
        </h3>

        <div className="space-y-3 text-sm text-text-secondary">
          <div className="flex gap-3">
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <p>{dict["consentRule1"] ?? "Dein Warenkorb hat ein 3-Stunden-Reservierungsfenster. Die erste beanspruchte Karte startet den Timer."}</p>
          </div>
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <p>{dict["consentRule2"] ?? "Wenn du den Checkout nicht innerhalb von 3 Stunden abschließt, werden alle Karten automatisch in Coins umgewandelt."}</p>
          </div>
          <div className="flex gap-3">
            <Coins className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <p>{dict["consentRule3"] ?? "Du kannst einzelne Karten jederzeit manuell im Warenkorb in Coins umwandeln."}</p>
          </div>
        </div>

        <button
          onClick={onAccept}
          className="mt-6 w-full rounded-lg bg-pa-green px-4 py-3 text-sm font-semibold text-black hover:bg-pa-green/90"
        >
          {dict["consentAccept"] ?? "Verstanden"}
        </button>
      </div>
    </div>
  );
}
