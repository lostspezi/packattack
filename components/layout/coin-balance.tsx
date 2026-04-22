"use client";

import React, { useState, useEffect, useRef } from "react";
import { Coins } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { fetchProfile } from "@/lib/profile-client";
import { useMe } from "@/components/layout/me-provider";

export function CoinBalance() {
  const me = useMe();
  // `override` wins once an event-driven fetch returns a newer value;
  // otherwise we derive coins directly from the /api/me snapshot.
  const [override, setOverride] = useState<number | null>(null);
  const coins = override ?? me?.coins ?? null;
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
        void fetchProfile().then((data) => {
          if (data?.coins !== undefined) setOverride(data.coins);
        });
      }, 300);
    }

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
