"use client";

import React, { useState, useEffect, useRef } from "react";
import { Coins } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function CoinBalance() {
  const [coins, setCoins] = useState<number | null>(null);
  const [floatText, setFloatText] = useState<string | null>(null);
  const [glowing, setGlowing] = useState(false);
  const [popping, setPopping] = useState(false);
  const pathname = usePathname();
  const lang = pathname.split("/")[1] || "de";
  const floatTimeout = useRef<ReturnType<typeof setTimeout>>(null);
  const glowTimeout = useRef<ReturnType<typeof setTimeout>>(null);

  const fetchDebounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    function fetchBalance() {
      if (fetchDebounceRef.current) clearTimeout(fetchDebounceRef.current);
      fetchDebounceRef.current = setTimeout(() => {
        fetch("/api/profile")
          .then((r) => r.json())
          .then((data) => {
            if (data?.coins !== undefined) setCoins(data.coins);
          })
          .catch(() => {});
      }, 300);
    }

    // Initial fetch (no debounce)
    fetch("/api/profile")
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as { coins?: number };
        setCoins(data.coins ?? 0);
      })
      .catch(() => {});

    function handleRefresh() {
      fetchBalance();
    }

    function handleChange(e: Event) {
      const detail = (e as CustomEvent<{ delta: number }>).detail;
      const delta = detail?.delta;

      fetchBalance();

      // Show float text
      if (delta && delta !== 0) {
        const sign = delta > 0 ? "+" : "";
        setFloatText(`${sign}${delta}`);
        if (floatTimeout.current) clearTimeout(floatTimeout.current);
        floatTimeout.current = setTimeout(() => setFloatText(null), 1500);
      }

      // Glow + pop effect
      setGlowing(true);
      setPopping(true);
      if (glowTimeout.current) clearTimeout(glowTimeout.current);
      glowTimeout.current = setTimeout(() => {
        setGlowing(false);
        setPopping(false);
      }, 1000);
    }

    window.addEventListener("coin-balance-refresh", handleRefresh);
    window.addEventListener("coin-balance-change", handleChange);
    return () => {
      window.removeEventListener("coin-balance-refresh", handleRefresh);
      window.removeEventListener("coin-balance-change", handleChange);
      if (fetchDebounceRef.current) clearTimeout(fetchDebounceRef.current);
    };
  }, []);

  if (coins === null) return null;

  return (
    <Link
      href={`/${lang}/balance`}
      className={[
        "relative flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 transition-all duration-300",
        glowing
          ? "border-pa-green/60 bg-pa-green/20 shadow-[0_0_20px_rgba(155,255,0,0.35)]"
          : "border-pa-green/15 bg-pa-green/8 hover:opacity-80",
        popping ? "animate-coin-pop" : "",
      ].join(" ")}
    >
      <Coins className="h-4 w-4 text-pa-green" />
      <span className="text-sm font-semibold tabular-nums text-pa-green">
        {coins.toLocaleString()}
      </span>
      {floatText && (
        <span className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 animate-coin-float text-sm font-bold text-pa-green drop-shadow-[0_0_6px_rgba(155,255,0,0.5)]">
          {floatText}
        </span>
      )}
    </Link>
  );
}
