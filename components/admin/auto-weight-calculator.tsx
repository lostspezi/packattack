"use client";

import React, { useState } from "react";
import { Calculator, Sparkles } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { calculateAutoWeights } from "@/lib/auto-weights";
import type { BoxCard } from "@/components/admin/box-card-manager";

interface AutoWeightCalculatorProps {
  cards: BoxCard[];
  cardsPerPack: number;
  lang: string;
  onApply: (updates: { cardId: string; weight: number; coinValue: number }[], suggestedPackPrice: number) => void;
}

export function AutoWeightCalculator({
  cards,
  cardsPerPack,
  lang,
  onApply,
}: AutoWeightCalculatorProps) {
  const isDe = lang === "de";
  const [open, setOpen] = useState(false);
  const [margin, setMargin] = useState("30");
  const [preview, setPreview] = useState<{
    updates: { cardId: string; name: string; oldWeight: number; newWeight: number; oldCoins: number; newCoins: number; marketPrice: number }[];
    suggestedPackPrice: number;
    expectedPackValue: number;
  } | null>(null);

  const hasCards = cards.length > 0;
  const cardsWithPrice = cards.filter((c) => (c.marketPrice ?? 0) > 0).length;
  const marginNum = Math.max(0, Math.min(99, parseInt(margin, 10) || 0));

  function handleCalculate() {
    const result = calculateAutoWeights(
      cards.map((c) => ({ _id: c._id, marketPrice: c.marketPrice, internalPrice: c.internalPrice })),
      cardsPerPack,
      marginNum
    );

    const updates = cards.map((c) => ({
      cardId: c._id,
      name: c.name,
      marketPrice: c.marketPrice ?? 0,
      oldWeight: c.weight,
      newWeight: result.weights.get(c._id) ?? c.weight,
      oldCoins: c.internalPrice ?? 0,
      newCoins: result.coinValues.get(c._id) ?? 0,
    }));

    setPreview({
      updates,
      suggestedPackPrice: result.suggestedPackPrice,
      expectedPackValue: result.expectedPackValue,
    });
  }

  function handleApply() {
    if (!preview) return;
    onApply(
      preview.updates.map((u) => ({ cardId: u.cardId, weight: u.newWeight, coinValue: u.newCoins })),
      preview.suggestedPackPrice
    );
    setOpen(false);
    setPreview(null);
  }

  function handleOpen() {
    setPreview(null);
    setOpen(true);
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={!hasCards}
        onClick={handleOpen}
        className="flex items-center gap-1.5"
      >
        <Calculator className="w-3.5 h-3.5" />
        {isDe ? "Auto-Berechnung" : "Auto-Calculate"}
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={isDe ? "Gewichte & Preise berechnen" : "Calculate Weights & Prices"}
        size={preview ? "xl" : "sm"}
      >
        <div className="space-y-4">
          {!preview ? (
            <>
              <p className="text-sm text-text-secondary">
                {isDe
                  ? "Berechnet automatisch Gewichte (basierend auf Marktpreis) und Coin-Werte für alle Karten. Teurere Karten werden seltener gezogen."
                  : "Automatically calculates weights (based on market price) and coin values for all cards. More expensive cards will be drawn less often."}
              </p>

              {/* Margin */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-text-muted">
                  {isDe ? "Marge (%)" : "Margin (%)"}
                </label>
                <Input
                  type="number"
                  min={0}
                  max={99}
                  value={margin}
                  onChange={(e) => setMargin(e.target.value)}
                  className="py-2 text-sm w-24"
                />
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {[10, 20, 30, 40, 50].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setMargin(String(v))}
                      className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${
                        marginNum === v
                          ? "bg-pa-green/10 text-pa-green border-pa-green/20"
                          : "bg-white/4 text-text-secondary border-border hover:bg-white/6"
                      }`}
                    >
                      {v}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Info */}
              <div className="bg-white/4 border border-border rounded-xl p-3 text-[13px] text-text-secondary space-y-1">
                <p>{isDe ? "So funktioniert es:" : "How it works:"}</p>
                <ul className="list-disc list-inside space-y-0.5 text-text-muted">
                  <li>{isDe ? "Coin-Wert = Marktpreis + 10% Aufschlag, aufgerundet" : "Coin value = market price + 10% markup, rounded up"}</li>
                  <li>{isDe ? "Gewicht = umgekehrt proportional zum Preis (teurer = seltener)" : "Weight = inversely proportional to price (more expensive = rarer)"}</li>
                  <li>{isDe ? "Pack-Preis = Erwartungswert pro Pack + Marge" : "Pack price = expected pack value + margin"}</li>
                </ul>
              </div>

              {cardsWithPrice < cards.length && (
                <p className="text-xs text-yellow-400">
                  {isDe
                    ? `${cards.length - cardsWithPrice} Karte(n) ohne Marktpreis — bekommen den Median-Preis zugewiesen.`
                    : `${cards.length - cardsWithPrice} card(s) without market price — will be assigned median price.`}
                </p>
              )}

              <div className="flex gap-3 justify-end pt-2">
                <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
                  {isDe ? "Abbrechen" : "Cancel"}
                </Button>
                <Button variant="primary" size="sm" onClick={handleCalculate}>
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  {isDe ? "Berechnen" : "Calculate"}
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Preview */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-white/4 border border-border rounded-xl p-3">
                  <p className="text-[11px] text-text-muted uppercase tracking-wider">{isDe ? "Marge" : "Margin"}</p>
                  <p className="text-lg font-bold text-text-primary">{marginNum}%</p>
                </div>
                <div className="bg-white/4 border border-border rounded-xl p-3">
                  <p className="text-[11px] text-text-muted uppercase tracking-wider">{isDe ? "Ø Pack-Wert" : "Exp. Pack Value"}</p>
                  <p className="text-lg font-bold text-text-primary">{preview.expectedPackValue.toFixed(2)} Coins</p>
                </div>
                <div className="bg-pa-green/5 border border-pa-green/20 rounded-xl p-3">
                  <p className="text-[11px] text-text-muted uppercase tracking-wider">{isDe ? "Pack-Preis Vorschlag" : "Suggested Pack Price"}</p>
                  <p className="text-lg font-bold text-pa-green">{preview.suggestedPackPrice} Coins</p>
                </div>
              </div>

              {/* Card changes table */}
              <div className="overflow-x-auto max-h-[320px]">
                <table className="w-full min-w-[560px]">
                  <thead className="sticky top-0 bg-surface-elevated">
                    <tr className="border-b border-border">
                      <th className="px-2 py-2 text-left text-xs font-medium text-text-secondary uppercase">{isDe ? "Karte" : "Card"}</th>
                      <th className="px-2 py-2 text-right text-xs font-medium text-text-secondary uppercase">{isDe ? "Marktpreis" : "Market"}</th>
                      <th className="px-2 py-2 text-right text-xs font-medium text-text-secondary uppercase">{isDe ? "Gewicht" : "Weight"}</th>
                      <th className="px-2 py-2 text-right text-xs font-medium text-text-secondary uppercase">Coins</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...preview.updates].sort((a, b) => a.marketPrice - b.marketPrice).map((u) => (
                      <tr key={u.cardId} className="border-b border-border/30 last:border-0">
                        <td className="px-2 py-1.5 text-sm text-text-primary truncate max-w-[180px]">{u.name}</td>
                        <td className="px-2 py-1.5 text-sm text-text-muted text-right tabular-nums">${u.marketPrice.toFixed(2)}</td>
                        <td className="px-2 py-1.5 text-sm text-right tabular-nums">
                          <span className="text-text-muted">{u.oldWeight}</span>
                          <span className="text-text-muted mx-1">→</span>
                          <span className={u.oldWeight !== u.newWeight ? "text-pa-green font-medium" : "text-text-primary"}>{u.newWeight}</span>
                        </td>
                        <td className="px-2 py-1.5 text-sm text-right tabular-nums">
                          <span className="text-text-muted">{u.oldCoins}</span>
                          <span className="text-text-muted mx-1">→</span>
                          <span className={u.oldCoins !== u.newCoins ? "text-pa-green font-medium" : "text-text-primary"}>{u.newCoins}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <Button variant="secondary" size="sm" onClick={() => setPreview(null)}>
                  {isDe ? "Zurück" : "Back"}
                </Button>
                <Button variant="primary" size="sm" onClick={handleApply}>
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  {isDe ? "Übernehmen" : "Apply"}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
