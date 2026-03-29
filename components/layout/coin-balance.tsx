"use client";

import React, { useState, useEffect, useRef } from "react";
import { Coins } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function CoinBalance() {
  const [coins, setCoins] = useState<number | null>(null);
  const [floatText, setFloatText] = useState<string | null>(null);
  const [glowing, setGlowing] = useState(false);
  const pathname = usePathname();
  const lang = pathname.split("/")[1] || "de";
  const floatTimeout = useRef<ReturnType<typeof setTimeout>>(null);
  const glowTimeout = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as { coins?: number };
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

    function handleChange(e: Event) {
      const detail = (e as CustomEvent<{ delta: number }>).detail;
      const delta = detail?.delta;

      // Refresh balance
      fetch("/api/profile")
        .then((r) => r.json())
        .then((data) => {
          if (data?.coins !== undefined) setCoins(data.coins);
        });

      // Show float text
      if (delta && delta !== 0) {
        const sign = delta > 0 ? "+" : "";
        setFloatText(`${sign}${delta}`);
        if (floatTimeout.current) clearTimeout(floatTimeout.current);
        floatTimeout.current = setTimeout(() => setFloatText(null), 1200);
      }

      // Glow effect
      setGlowing(true);
      if (glowTimeout.current) clearTimeout(glowTimeout.current);
      glowTimeout.current = setTimeout(() => setGlowing(false), 800);
    }

    window.addEventListener("coin-balance-refresh", handleRefresh);
    window.addEventListener("coin-balance-change", handleChange);
    return () => {
      window.removeEventListener("coin-balance-refresh", handleRefresh);
      window.removeEventListener("coin-balance-change", handleChange);
    };
  }, []);

  if (coins === null) return null;

  return (
    <Link
      href={`/${lang}/balance`}
      className={[
        "relative flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 transition-all",
        glowing
          ? "border-pa-green/50 bg-pa-green/15 shadow-[0_0_12px_rgba(155,255,0,0.25)]"
          : "border-pa-green/15 bg-pa-green/8 hover:opacity-80",
      ].join(" ")}
    >
      <Coins className="h-4 w-4 text-pa-green" />
      <span className="text-sm font-semibold tabular-nums text-pa-green">
        {coins.toLocaleString()}
      </span>
      {floatText && (
        <span className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 animate-coin-float text-xs font-bold text-pa-green">
          {floatText}
        </span>
      )}
    </Link>
  );
}
