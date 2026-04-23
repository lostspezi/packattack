"use client";

import { usePathname } from "next/navigation";
import { Sparkles, X } from "lucide-react";
import { usePacki } from "@/components/packi/packi-provider";
import { isPackiVisible } from "@/components/packi/lib/route-scope";

export function PackiFab() {
  const pathname = usePathname();
  const { open, togglePanel } = usePacki();

  if (!isPackiVisible(pathname)) return null;

  return (
    <button
      type="button"
      onClick={togglePanel}
      aria-label={open ? "Packi schließen" : "Packi öffnen"}
      aria-expanded={open}
      className={[
        "fixed z-[99]",
        "bottom-5 right-5 xl:right-[calc(420px+20px)]",
        "h-12 w-12 rounded-full",
        "bg-pa-green text-black shadow-lg",
        "flex items-center justify-center",
        "hover:scale-105 transition-transform",
        "focus:outline-none focus:ring-2 focus:ring-pa-green/40",
      ].join(" ")}
    >
      {open ? (
        <X className="h-5 w-5" aria-hidden="true" />
      ) : (
        <Sparkles className="h-5 w-5" aria-hidden="true" />
      )}
    </button>
  );
}
