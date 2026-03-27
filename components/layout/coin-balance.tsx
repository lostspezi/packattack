"use client";

import React, { useState, useEffect } from "react";
import { Coins } from "lucide-react";
import Link from "next/link";

export function CoinBalance() {
  const [coins, setCoins] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json() as { coins?: number };
        setCoins(data.coins ?? 0);
      })
      .catch(() => {});

    function handleRefresh() {
      fetch("/api/profile")
        .then((r) => r.json())
        .then((data) => {
          if (data?.coins !== undefined) setCoins(data.coins);
        });
    }
    window.addEventListener("coin-balance-refresh", handleRefresh);
    return () => window.removeEventListener("coin-balance-refresh", handleRefresh);
  }, []);

  if (coins === null) return null;

  return (
    <Link href="/balance" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-pa-green/8 border border-pa-green/15 cursor-pointer hover:opacity-80 transition-opacity">
      <Coins className="w-4 h-4 text-pa-green" />
      <span className="text-sm font-semibold text-pa-green tabular-nums">{coins.toLocaleString()}</span>
    </Link>
  );
}
