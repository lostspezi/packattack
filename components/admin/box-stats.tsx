"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface BoxStatsProps {
  boxId: string;
  lang: string;
}

interface StatsData {
  period: string;
  packsOpened: number;
  totalPulls: number;
  revenue: number;
  payouts: number;
  margin: number;
  marginPercent: number;
  uniqueUsers: number;
  avgPacksPerUser: number;
  claimRate: number;
  claimed: number;
  converted: number;
  outOfStock: number;
  lowStock: number;
  avgPackValue: number;
  topCards: Array<{ _id: string; count: number; rarity: string; coinValue: number }>;
  dailyPulls: Array<{ date: string; count: number }>;
}

const PERIODS = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "all", label: "All Time" },
];

function KpiCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-white/4 border border-border rounded-xl p-3">
      <p className="text-[11px] text-text-muted uppercase tracking-wider">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${color ?? "text-text-primary"}`}>{value}</p>
    </div>
  );
}

export function BoxStats({ boxId, lang }: BoxStatsProps) {
  const isDe = lang === "de";
  const [period, setPeriod] = useState("all");
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/boxes/${boxId}/stats?period=${period}`)
      .then(async (res) => {
        if (!res.ok) return;
        setData(await res.json() as StatsData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [boxId, period]);

  const chartOptions: ApexCharts.ApexOptions = {
    chart: { type: "bar", background: "transparent", toolbar: { show: false } },
    colors: ["#9BFF00"],
    plotOptions: { bar: { borderRadius: 3, columnWidth: "70%" } },
    dataLabels: { enabled: false },
    xaxis: {
      categories: data?.dailyPulls.map((d) => d.date.slice(5)) ?? [],
      labels: { style: { colors: "#6B6B78", fontSize: "10px" }, rotate: -45 },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: { labels: { style: { colors: "#6B6B78", fontSize: "11px" } } },
    grid: { borderColor: "#2D2C3D" },
    tooltip: { theme: "dark" },
  };

  return (
    <div className="bg-surface border border-border rounded-[14px] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">
          {isDe ? "Statistiken" : "Statistics"}
        </h3>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${
                period === p.value
                  ? "bg-pa-green/10 text-pa-green border-pa-green/20"
                  : "bg-white/4 text-text-secondary border-border hover:bg-white/6"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center">
          <Loader2 className="w-5 h-5 animate-spin mx-auto text-pa-green" />
        </div>
      ) : !data ? (
        <p className="py-4 text-center text-sm text-text-muted">
          {isDe ? "Keine Daten verfügbar." : "No data available."}
        </p>
      ) : (
        <>
          {/* KPI Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
            <KpiCard label={isDe ? "Packs geöffnet" : "Packs Opened"} value={data.packsOpened.toLocaleString()} />
            <KpiCard label={isDe ? "Umsatz" : "Revenue"} value={`${data.revenue.toLocaleString()} Coins`} color="text-pa-green" />
            <KpiCard label={isDe ? "Auszahlungen" : "Payouts"} value={`${data.payouts.toLocaleString()} Coins`} color="text-red-400" />
            <KpiCard
              label={isDe ? "Marge" : "Margin"}
              value={`${data.margin.toLocaleString()} (${data.marginPercent}%)`}
              color={data.margin >= 0 ? "text-pa-green" : "text-red-400"}
            />
            <KpiCard label={isDe ? "Unique User" : "Unique Users"} value={String(data.uniqueUsers)} />
            <KpiCard label={isDe ? "Ø Packs/User" : "Avg Packs/User"} value={String(data.avgPacksPerUser)} />
            <KpiCard label={isDe ? "Claim-Rate" : "Claim Rate"} value={`${data.claimRate}%`} />
            <KpiCard label={isDe ? "Ø Pack-Wert" : "Avg Pack Value"} value={`${data.avgPackValue} Coins`} />
          </div>

          {/* Status breakdown */}
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="success">{data.claimed} {isDe ? "Geclaimed" : "Claimed"}</Badge>
            <Badge variant="info">{data.converted} {isDe ? "Umgewandelt" : "Converted"}</Badge>
            {data.outOfStock > 0 && <Badge variant="error">{data.outOfStock} {isDe ? "Ausverkauft" : "Out of Stock"}</Badge>}
            {data.lowStock > 0 && <Badge variant="warning">{data.lowStock} {isDe ? "Niedriger Bestand" : "Low Stock"}</Badge>}
          </div>

          {/* Daily pulls chart */}
          {data.dailyPulls.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-text-muted mb-2">
                {isDe ? "Pulls pro Tag (30 Tage)" : "Pulls per Day (30 days)"}
              </h4>
              <div className="h-[180px]">
                <Chart
                  type="bar"
                  height="100%"
                  options={chartOptions}
                  series={[{ name: "Pulls", data: data.dailyPulls.map((d) => d.count) }]}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
