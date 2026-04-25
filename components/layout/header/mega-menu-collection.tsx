"use client";

import Link from "next/link";
import { NAV_ITEMS } from "./nav-config";

interface MegaMenuCollectionProps {
  lang: string;
  dict: Record<string, string>;
  onClose: () => void;
}

export function MegaMenuCollection({
  lang,
  dict,
  onClose,
}: MegaMenuCollectionProps) {
  const collection = NAV_ITEMS.find((item) => item.key === "collection");
  const children = collection?.children ?? [];

  return (
    <div className="flex flex-wrap gap-6">
      {children.map((child) => {
        const Icon = child.icon;
        return (
          <Link
            key={child.key}
            href={child.href(lang)}
            onClick={onClose}
            className="group flex min-w-[240px] max-w-sm flex-1 items-start gap-3 rounded-xl p-3 transition-colors hover:bg-white/5"
          >
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${child.accent.bg}`}
            >
              <Icon className={`h-5 w-5 ${child.accent.icon}`} />
            </div>
            <div>
              <p
                className={`text-sm font-medium text-text-primary transition-colors ${child.accent.hover}`}
              >
                {dict[child.labelKey] ?? child.labelFallback}
              </p>
              <p className="mt-0.5 text-xs text-text-muted">
                {dict[child.descKey] ?? child.descFallback}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
