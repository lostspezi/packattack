"use client";

import React, { useState, useCallback } from "react";
import { Dices, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { runSimulation, type SimulationResult } from "@/lib/pack-simulation";
import { PackSimulationResults } from "@/components/admin/pack-simulation-results";
import type { BoxCard } from "@/components/admin/box-card-manager";

interface PackSimulationButtonProps {
  cards: BoxCard[];
  cardsPerPack: number;
  priceInCoins: number;
  lang: string;
}

const QUICK_VALUES = [10, 100, 1_000, 10_000];
const MIN_PACKS = 1;
const MAX_PACKS = 10_000;

export function PackSimulationButton({
  cards,
  cardsPerPack,
  priceInCoins,
  lang,
}: PackSimulationButtonProps) {
  const isDe = lang === "de";

  const [showParams, setShowParams] = useState(false);
  const [packCount, setPackCount] = useState("100");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [showResults, setShowResults] = useState(false);

  const availableCards = cards.filter((c) => (c.stock ?? 0) > 0);
  const outOfStock = cards.length - availableCards.length;
  const hasCards = availableCards.length > 0;
  const numPacks = Math.max(MIN_PACKS, Math.min(MAX_PACKS, parseInt(packCount, 10) || 0));
  const totalDraws = numPacks * cardsPerPack;
  const cardsWithoutPrice = availableCards.filter((c) => !c.internalPrice).length;

  const handleStartSimulation = useCallback(() => {
    setShowParams(false);
    setRunning(true);
    setShowResults(true);

    // setTimeout so the loading state renders before synchronous computation
    setTimeout(() => {
      // Exclude out-of-stock cards from simulation
      const availableCards = cards.filter((c) => (c.stock ?? 0) > 0);
      const simResult = runSimulation({
        cards: availableCards.map((c) => ({
          _id: c._id,
          name: c.name,
          rarity: c.rarity,
          weight: c.weight,
          marketPrice: c.marketPrice,
          internalPrice: c.internalPrice,
          image: c.image,
        })),
        cardsPerPack,
        numPacks,
        priceInCoins,
      });
      setResult(simResult);
      setRunning(false);
    }, 0);
  }, [cards, cardsPerPack, numPacks, priceInCoins]);

  function handleRunAgain() {
    setShowResults(false);
    setResult(null);
    setShowParams(true);
  }

  function handleCloseResults() {
    setShowResults(false);
    setResult(null);
  }

  return (
    <>
      {/* Trigger button */}
      <Button
        type="button"
        variant="secondary"
        size="md"
        disabled={!hasCards || running}
        onClick={() => setShowParams(true)}
      >
        {running ? (
          <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
        ) : (
          <Dices className="w-4 h-4 mr-1.5" />
        )}
        {isDe ? "Simulation" : "Simulate"}
      </Button>

      {/* Parameter modal */}
      <Modal
        open={showParams}
        onClose={() => setShowParams(false)}
        title={isDe ? "Pack-Simulation" : "Pack Simulation"}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            {isDe
              ? "Simuliere das Öffnen von Packs um die Gewichtungsverteilung zu testen."
              : "Simulate opening packs to test the weight distribution."}
          </p>

          {/* Pack count input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-text-muted">
              {isDe ? "Anzahl Packs" : "Number of Packs"}
            </label>
            <Input
              type="number"
              min={MIN_PACKS}
              max={MAX_PACKS}
              value={packCount}
              onChange={(e) => setPackCount(e.target.value)}
              className="py-2 text-sm"
            />
          </div>

          {/* Quick select chips */}
          <div className="flex flex-wrap gap-2">
            {QUICK_VALUES.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setPackCount(String(v))}
                className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                  parseInt(packCount, 10) === v
                    ? "bg-pa-green/10 text-pa-green border-pa-green/20"
                    : "bg-white/4 text-text-secondary border-border hover:bg-white/6"
                }`}
              >
                {v.toLocaleString()}
              </button>
            ))}
          </div>

          {/* Info text */}
          <p className="text-xs text-text-muted">
            {availableCards.length} {isDe ? "Karten" : "cards"} × {cardsPerPack} {isDe ? "pro Pack" : "per pack"} = {totalDraws.toLocaleString()} {isDe ? "Ziehungen" : "draws"}
          </p>

          {outOfStock > 0 && (
            <p className="text-xs text-yellow-400">
              {isDe
                ? `${outOfStock} Karte(n) ohne Bestand — werden von der Simulation ausgeschlossen.`
                : `${outOfStock} card(s) out of stock — excluded from simulation.`}
            </p>
          )}

          {/* Price warning */}
          {cardsWithoutPrice > 0 && (
            <p className="text-xs text-yellow-400">
              {isDe
                ? `${cardsWithoutPrice} Karte(n) ohne internen Preis (Coin-Wert) — Wertberechnung unvollständig.`
                : `${cardsWithoutPrice} card(s) without internal price (coin value) — value calculations will be incomplete.`}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" size="sm" onClick={() => setShowParams(false)}>
              {isDe ? "Abbrechen" : "Cancel"}
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={numPacks < MIN_PACKS || numPacks > MAX_PACKS}
              onClick={handleStartSimulation}
            >
              <Dices className="w-3.5 h-3.5 mr-1.5" />
              {isDe ? "Simulation starten" : "Run Simulation"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Results modal (loading or full results) */}
      {showResults && !result && (
        <Modal open={true} onClose={() => {}} title={isDe ? "Simulation läuft..." : "Simulating..."} size="sm">
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="w-8 h-8 text-pa-green animate-spin" />
            <p className="text-sm text-text-secondary">
              {isDe
                ? `Simuliere ${numPacks.toLocaleString()} Packs...`
                : `Simulating ${numPacks.toLocaleString()} packs...`}
            </p>
          </div>
        </Modal>
      )}

      {showResults && result && (
        <PackSimulationResults
          result={result}
          lang={lang}
          open={true}
          onClose={handleCloseResults}
          onRunAgain={handleRunAgain}
        />
      )}
    </>
  );
}
