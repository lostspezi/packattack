"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import type { JustTCGCardVariant } from "@/lib/justtcg";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface CardPriceChartProps {
  variants: JustTCGCardVariant[];
  cardName: string;
}

function formatPrice(price: number | null | undefined): string {
  if (price === null || price === undefined) return "—";
  return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatChange(change: number | null | undefined): {
  label: string;
  positive: boolean | null;
} {
  if (change === null || change === undefined)
    return { label: "—", positive: null };
  const sign = change > 0 ? "+" : "";
  return { label: `${sign}${change.toFixed(2)}%`, positive: change >= 0 };
}

export function CardPriceChart({ variants, cardName }: CardPriceChartProps) {
  const [period, setPeriod] = useState<"7d" | "30d">("30d");

  // Default to Near Mint variant, or first variant with price history
  const defaultIdx = Math.max(0,
    variants.findIndex((v) => v.condition === "Near Mint"),
    variants.findIndex((v) => Array.isArray(v.priceHistory) && v.priceHistory.length > 0)
  );
  const [activeVariantIdx, setActiveVariantIdx] = useState(defaultIdx);

  const variant = variants[activeVariantIdx] ?? variants[0];

  if (!variant) {
    return (
      <div className="text-center text-text-muted text-sm py-8">
        No variant data available.
      </div>
    );
  }

  const history =
    period === "7d" ? variant.priceHistory : variant.priceHistory30d;

  const seriesData: [number, number][] =
    Array.isArray(history) && history.length > 0
      ? history.map((pt) => [pt.t * 1000, pt.p])
      : [];

  const change7d = formatChange(variant.priceChange7d);
  const change30d = formatChange(variant.priceChange30d);
  const change90d = formatChange(variant.priceChange90d);

  const chartOptions: ApexCharts.ApexOptions = {
    chart: {
      type: "area",
      background: "transparent",
      toolbar: { show: false },
      zoom: { enabled: false },
      animations: { enabled: true, speed: 400 },
    },
    theme: { mode: "dark" },
    colors: ["#9BFF00"],
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.4,
        opacityTo: 0.05,
        stops: [0, 100],
      },
    },
    stroke: { curve: "smooth", width: 2 },
    grid: { borderColor: "#2D2C3D", strokeDashArray: 4 },
    xaxis: {
      type: "datetime",
      labels: { style: { colors: "#6B6B78" } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { colors: "#6B6B78" },
        formatter: (v: number) => `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      },
    },
    tooltip: {
      theme: "dark",
      x: { format: "dd MMM yyyy" },
      y: { formatter: (v: number) => `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
    },
    dataLabels: { enabled: false },
    markers: { size: 0 },
  };

  const series = [
    {
      name: cardName,
      data: seriesData,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Variant selector tabs */}
      {variants.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {variants.map((v, i) => (
            <button
              key={`${v.condition}-${v.printing}`}
              onClick={() => setActiveVariantIdx(i)}
              className={[
                "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                activeVariantIdx === i
                  ? "bg-pa-green text-bg border-pa-green"
                  : "bg-transparent text-text-secondary border-border hover:border-pa-green hover:text-pa-green",
              ].join(" ")}
            >
              {v.condition} {v.printing !== "Normal" ? `· ${v.printing}` : ""}
            </button>
          ))}
        </div>
      )}

      {/* Price badges */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="text-text-muted text-xs">
          Current:{" "}
          <span className="text-pa-green font-semibold text-sm">
            {formatPrice(variant.price)}
          </span>
        </div>
        {(
          [
            { label: "7d", data: change7d },
            { label: "30d", data: change30d },
            { label: "90d", data: change90d },
          ] as const
        ).map(({ label, data }) => (
          <span
            key={label}
            className={[
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
              data.positive === true
                ? "bg-green-500/15 text-green-400"
                : data.positive === false
                  ? "bg-red-500/15 text-red-400"
                  : "bg-white/5 text-text-muted",
            ].join(" ")}
          >
            {label}: {data.label}
          </span>
        ))}
      </div>

      {/* Period toggle */}
      <div className="flex gap-2">
        {(["7d", "30d"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={[
              "px-3 py-1 rounded text-xs font-medium transition-colors",
              period === p
                ? "bg-pa-green text-bg"
                : "bg-white/5 text-text-secondary hover:bg-white/10",
            ].join(" ")}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Chart */}
      {seriesData.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-text-muted text-sm rounded-lg border border-border gap-2">
          <span>No price chart available for this variant.</span>
          {variant.avgPrice30d && (
            <span className="text-text-secondary">
              30d avg: <span className="text-pa-green font-medium">{formatPrice(variant.avgPrice30d)}</span>
            </span>
          )}
        </div>
      ) : (
        <div className="rounded-lg overflow-hidden" style={{ background: "#12111A" }}>
          <Chart
            type="area"
            options={chartOptions}
            series={series}
            height={220}
            width="100%"
          />
        </div>
      )}
    </div>
  );
}
