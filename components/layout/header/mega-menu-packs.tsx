"use client";

import Link from "next/link";
import { Package, Sparkles, Clock } from "lucide-react";

interface MegaMenuPacksProps {
  lang: string;
  dict: Record<string, string>;
  onClose: () => void;
}

export function MegaMenuPacks({ lang, dict, onClose }: MegaMenuPacksProps) {
  return (
    <div className="grid grid-cols-3 gap-6">
      <Link
        href={`/${lang}/packs`}
        onClick={onClose}
        className="group flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-white/5"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-pa-green/10">
          <Package className="h-5 w-5 text-pa-green" />
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary group-hover:text-pa-green transition-colors">
            {dict["all_packs"] ?? "Alle Packs"}
          </p>
          <p className="mt-0.5 text-xs text-text-muted">
            {dict["all_packs_desc"] ?? "Durchstöbere alle verfügbaren Packs"}
          </p>
        </div>
      </Link>

      <Link
        href={`/${lang}/packs?sort=featured`}
        onClick={onClose}
        className="group flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-white/5"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
          <Sparkles className="h-5 w-5 text-amber-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary group-hover:text-amber-400 transition-colors">
            {dict["featured_packs"] ?? "Featured Packs"}
          </p>
          <p className="mt-0.5 text-xs text-text-muted">
            {dict["featured_packs_desc"] ?? "Handverlesene Highlights"}
          </p>
        </div>
      </Link>

      <Link
        href={`/${lang}/dashboard`}
        onClick={onClose}
        className="group flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-white/5"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
          <Clock className="h-5 w-5 text-blue-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary group-hover:text-blue-400 transition-colors">
            {dict["recently_opened"] ?? "Zuletzt geöffnet"}
          </p>
          <p className="mt-0.5 text-xs text-text-muted">
            {dict["recently_opened_desc"] ?? "Deine letzten Pack Openings"}
          </p>
        </div>
      </Link>
    </div>
  );
}
