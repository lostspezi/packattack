"use client";

import React, { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, RotateCcw } from "lucide-react";
import type { SimulationResult, CardResult } from "@/lib/pack-simulation";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface PackSimulationResultsProps {
  result: SimulationResult;
  lang: string;
  open: boolean;
  onClose: () => void;
  onRunAgain: () => void;
}

type TabId = "cards" | "rarity" | "value";
type SortKey = "pullCount" | "pullPercentage" | "deviation" | "valueContributed" | "name";

function formatNum(n: number, decimals = 2): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function formatPct(n: number): string {
  if (Math.abs(n) < 0.01) return `${n.toFixed(4)}%`;
  if (Math.abs(n) < 1) return `${n.toFixed(3)}%`;
  return `${n.toFixed(2)}%`;
}

function KpiCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-white/4 border border-border rounded-xl p-3">
      <p className="text-[11px] text-text-muted uppercase tracking-wider">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${color ?? "text-text-primary"}`}>{value}</p>
    </div>
  );
}

export function PackSimulationResults({
  result,
  lang,
  open,
  onClose,
  onRunAgain,
}: PackSimulationResultsProps) {
  const isDe = lang === "de";
  const [activeTab, setActiveTab] = useState<TabId>("cards");
  const [sortKey, setSortKey] = useState<SortKey>("pullCount");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const plColor = result.profitLossCoins >= 0 ? "text-green-400" : "text-red-400";

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sortedCards = useMemo(() => {
    const sorted = [...result.cardResults];
    sorted.sort((a, b) => {
      const aVal = a[sortKey as keyof CardResult];
      const bVal = b[sortKey as keyof CardResult];
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
    return sorted;
  }, [result.cardResults, sortKey, sortDir]);

  const tabs: { id: TabId; label: string }[] = [
    { id: "cards", label: isDe ? "Karten" : "Cards" },
    { id: "rarity", label: isDe ? "Raritäten" : "Rarities" },
    { id: "value", label: isDe ? "Wert-Analyse" : "Value Analysis" },
  ];

  // Chart configs
  const rarityChartOptions: ApexCharts.ApexOptions = {
    chart: { type: "bar", background: "transparent", toolbar: { show: false } },
    plotOptions: { bar: { horizontal: true, barHeight: "60%" } },
    colors: ["#9BFF00", "#6B6B78"],
    dataLabels: { enabled: false },
    xaxis: { labels: { style: { colors: "#6B6B78", fontSize: "11px" } }, axisBorder: { show: false }, axisTicks: { show: false } },
    yaxis: { labels: { style: { colors: "#C8C8D0", fontSize: "12px" } } },
    grid: { borderColor: "#2D2C3D", xaxis: { lines: { show: true } }, yaxis: { lines: { show: false } } },
    legend: { labels: { colors: "#8A8A96" }, fontSize: "12px" },
    tooltip: { theme: "dark" },
  };

  const rarityChartSeries = [
    { name: isDe ? "Tatsächlich" : "Actual", data: result.rarityResults.map((r) => Math.round(r.pullPercentage * 100) / 100) },
    { name: isDe ? "Erwartet" : "Expected", data: result.rarityResults.map((r) => Math.round(r.expectedPercentage * 100) / 100) },
  ];

  const rarityChartCategories = result.rarityResults.map((r) => r.rarity);

  // Pack value histogram
  const histogramBins = useMemo(() => {
    const values = result.packValueDistribution;
    if (values.length === 0) return { categories: [] as string[], data: [] as number[] };
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const binCount = Math.min(20, Math.max(5, Math.ceil(Math.sqrt(values.length))));
    const binSize = range / binCount;
    const bins = new Array(binCount).fill(0);
    for (const v of values) {
      const idx = Math.min(Math.floor((v - min) / binSize), binCount - 1);
      bins[idx]++;
    }
    const categories = bins.map((_, i) => {
      const lo = min + i * binSize;
      const hi = lo + binSize;
      return `${formatNum(lo, 0)}-${formatNum(hi, 0)}`;
    });
    return { categories, data: bins };
  }, [result.packValueDistribution]);

  const histogramOptions: ApexCharts.ApexOptions = {
    chart: { type: "bar", background: "transparent", toolbar: { show: false } },
    colors: ["#9BFF00"],
    plotOptions: { bar: { borderRadius: 4, columnWidth: "85%" } },
    dataLabels: { enabled: false },
    xaxis: { categories: histogramBins.categories, labels: { style: { colors: "#6B6B78", fontSize: "10px" }, rotate: -45 }, axisBorder: { show: false }, axisTicks: { show: false } },
    yaxis: { labels: { style: { colors: "#6B6B78", fontSize: "11px" } } },
    grid: { borderColor: "#2D2C3D" },
    tooltip: { theme: "dark" },
  };

  function SortHeader({ k, children }: { k: SortKey; children: React.ReactNode }) {
    const active = sortKey === k;
    return (
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className={`inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wider ${active ? "text-pa-green" : "text-text-secondary"}`}
      >
        {children}
        <ArrowUpDown className="w-3 h-3" />
      </button>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={isDe ? "Simulations-Ergebnis" : "Simulation Results"} size="xl">
      <div className="space-y-5">
        {/* KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          <KpiCard label={isDe ? "Packs geöffnet" : "Packs Opened"} value={result.numPacks.toLocaleString()} />
          <KpiCard label={isDe ? "Gesamte Ziehungen" : "Total Draws"} value={result.totalDraws.toLocaleString()} />
          <KpiCard label={isDe ? "Eingesetzt" : "Total Cost"} value={`${result.totalCostCoins.toLocaleString()} Coins`} />
          <KpiCard label={isDe ? "Ziehungswert" : "Pull Value"} value={`${formatNum(result.totalPullValueCoins)} Coins`} color="text-pa-green" />
          <KpiCard label={isDe ? "Gewinn/Verlust" : "Profit/Loss"} value={`${result.profitLossCoins >= 0 ? "+" : ""}${formatNum(result.profitLossCoins)} Coins`} color={plColor} />
          <KpiCard label="ROI" value={`${result.roi >= 0 ? "+" : ""}${formatNum(result.roi)}%`} color={plColor} />
          <KpiCard
            label={isDe ? "Marge (Plattform)" : "Margin (Platform)"}
            value={`${formatNum(result.marginCoins)} Coins (${formatNum(result.marginPercent)}%)`}
            color={result.marginCoins >= 0 ? "text-pa-green" : "text-red-400"}
          />
          <KpiCard label={isDe ? "Ø Pack-Wert" : "Avg Pack Value"} value={`${formatNum(result.avgPackValueCoins)} Coins`} />
          <KpiCard label={isDe ? "Einzigartige Karten" : "Unique Cards"} value={`${result.uniqueCardsHit}/${result.totalCardsInBox}`} />
          {result.neverPulled > 0 && (
            <KpiCard label={isDe ? "Nie gezogen" : "Never Pulled"} value={String(result.neverPulled)} color="text-yellow-400" />
          )}
          <KpiCard label={isDe ? "Bestes Pack" : "Best Pack"} value={`${formatNum(result.bestPackValue)} Coins`} color="text-green-400" />
          <KpiCard label={isDe ? "Schlechtestes Pack" : "Worst Pack"} value={`${formatNum(result.worstPackValue)} Coins`} color="text-red-400" />
          <KpiCard label={isDe ? "Median Pack" : "Median Pack"} value={`${formatNum(result.medianPackValue)} Coins`} />
        </div>

        {result.cardsWithoutPrice > 0 && (
          <div className="bg-yellow-500/5 border border-yellow-500/15 rounded-xl px-4 py-2.5 text-[13px] text-yellow-300">
            {isDe
              ? `${result.cardsWithoutPrice} Karte(n) ohne internen Preis (Coin-Wert) — Wertberechnung unvollständig.`
              : `${result.cardsWithoutPrice} card(s) without internal price (coin value) — value calculations incomplete.`}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border pb-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === tab.id
                  ? "bg-white/6 text-pa-green border-b-2 border-pa-green"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "cards" && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-2 py-2 text-left text-xs font-medium text-text-secondary uppercase tracking-wider w-8">{isDe ? "Bild" : "Img"}</th>
                  <th className="px-2 py-2 text-left"><SortHeader k="name">{isDe ? "Name" : "Name"}</SortHeader></th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">{isDe ? "Rarität" : "Rarity"}</th>
                  <th className="px-2 py-2 text-right"><SortHeader k="pullCount">{isDe ? "Gezogen" : "Pulls"}</SortHeader></th>
                  <th className="px-2 py-2 text-right"><SortHeader k="pullPercentage">Draw%</SortHeader></th>
                  <th className="px-2 py-2 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">{isDe ? "Erwartet" : "Expected"}</th>
                  <th className="px-2 py-2 text-right"><SortHeader k="deviation">{isDe ? "Abw." : "Dev."}</SortHeader></th>
                  <th className="px-2 py-2 text-right"><SortHeader k="valueContributed">{isDe ? "Wert" : "Value"}</SortHeader></th>
                </tr>
              </thead>
              <tbody>
                {sortedCards.map((card) => (
                  <tr key={card.cardId} className="border-b border-border/50 last:border-0 hover:bg-white/3 transition-colors">
                    <td className="px-2 py-1.5">
                      {card.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={card.image} alt="" className="w-6 h-8 object-cover rounded" loading="lazy" />
                      ) : (
                        <div className="w-6 h-8 bg-white/4 rounded" />
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-sm text-text-primary font-medium max-w-[160px] truncate">{card.name}</td>
                    <td className="px-2 py-1.5"><Badge variant="info">{card.rarity}</Badge></td>
                    <td className="px-2 py-1.5 text-sm text-text-primary text-right tabular-nums">{card.pullCount.toLocaleString()}</td>
                    <td className="px-2 py-1.5 text-sm text-text-secondary text-right tabular-nums">{formatPct(card.pullPercentage)}</td>
                    <td className="px-2 py-1.5 text-sm text-text-muted text-right tabular-nums">{formatPct(card.expectedPercentage)}</td>
                    <td className="px-2 py-1.5 text-right">
                      <span className={`text-sm tabular-nums font-medium ${card.deviation > 0.5 ? "text-green-400" : card.deviation < -0.5 ? "text-red-400" : "text-text-muted"}`}>
                        {card.deviation > 0 ? "+" : ""}{formatPct(card.deviation)}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-sm text-text-primary text-right tabular-nums">{formatNum(card.valueContributed)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "rarity" && (
          <div className="space-y-4">
            <div className="h-[250px]">
              <Chart
                type="bar"
                height="100%"
                options={{
                  ...rarityChartOptions,
                  xaxis: { ...rarityChartOptions.xaxis, categories: rarityChartCategories },
                }}
                series={rarityChartSeries}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase">{isDe ? "Rarität" : "Rarity"}</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-text-secondary uppercase">{isDe ? "Gezogen" : "Pulls"}</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-text-secondary uppercase">{isDe ? "Tatsächlich" : "Actual"}</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-text-secondary uppercase">{isDe ? "Erwartet" : "Expected"}</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-text-secondary uppercase">{isDe ? "Abw." : "Dev."}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rarityResults.map((r) => (
                    <tr key={r.rarity} className="border-b border-border/50 last:border-0">
                      <td className="px-3 py-2 text-sm font-medium text-text-primary">{r.rarity}</td>
                      <td className="px-3 py-2 text-sm text-text-secondary text-right tabular-nums">{r.pullCount.toLocaleString()}</td>
                      <td className="px-3 py-2 text-sm text-text-primary text-right tabular-nums">{formatPct(r.pullPercentage)}</td>
                      <td className="px-3 py-2 text-sm text-text-muted text-right tabular-nums">{formatPct(r.expectedPercentage)}</td>
                      <td className="px-3 py-2 text-right">
                        <span className={`text-sm tabular-nums font-medium ${r.deviation > 0.5 ? "text-green-400" : r.deviation < -0.5 ? "text-red-400" : "text-text-muted"}`}>
                          {r.deviation > 0 ? "+" : ""}{formatPct(r.deviation)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "value" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KpiCard label={isDe ? "Bestes Pack" : "Best Pack"} value={`${formatNum(result.bestPackValue)} Coins`} color="text-green-400" />
              <KpiCard label={isDe ? "Schlechtestes Pack" : "Worst Pack"} value={`${formatNum(result.worstPackValue)} Coins`} color="text-red-400" />
              <KpiCard label="Median" value={`${formatNum(result.medianPackValue)} Coins`} />
              <KpiCard label={isDe ? "Durchschnitt" : "Average"} value={`${formatNum(result.avgPackValueCoins)} Coins`} />
            </div>

            {histogramBins.data.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-text-primary mb-2">
                  {isDe ? "Pack-Wert-Verteilung" : "Pack Value Distribution"}
                </h4>
                <div className="h-[220px]">
                  <Chart
                    type="bar"
                    height="100%"
                    options={histogramOptions}
                    series={[{ name: "Packs", data: histogramBins.data }]}
                  />
                </div>
              </div>
            )}

            {/* Value by rarity */}
            <div>
              <h4 className="text-sm font-medium text-text-primary mb-2">
                {isDe ? "Wert nach Rarität" : "Value by Rarity"}
              </h4>
              <div className="space-y-2">
                {result.rarityResults.map((r) => {
                  const rarityValue = result.cardResults
                    .filter((c) => c.rarity === r.rarity)
                    .reduce((a, c) => a + c.valueContributed, 0);
                  const pct = result.totalPullValueCoins > 0 ? (rarityValue / result.totalPullValueCoins) * 100 : 0;
                  return (
                    <div key={r.rarity} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-text-primary font-medium">{r.rarity}</span>
                        <span className="text-text-secondary tabular-nums">{formatNum(rarityValue)} Coins ({formatPct(pct)})</span>
                      </div>
                      <div className="h-1.5 bg-white/6 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-pa-green/70 rounded-full transition-all"
                          style={{ width: `${Math.min(100, pct)}%`, minWidth: pct > 0 ? "2px" : "0" }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="flex gap-3 justify-end pt-2 border-t border-border">
          <Button variant="secondary" size="sm" onClick={onClose}>
            {isDe ? "Schließen" : "Close"}
          </Button>
          <Button variant="primary" size="sm" onClick={onRunAgain}>
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            {isDe ? "Erneut simulieren" : "Run Again"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
