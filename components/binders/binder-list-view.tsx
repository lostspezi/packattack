"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Loader2,
  Plus,
  Globe,
  Lock,
  Layers,
} from "lucide-react";
import { BINDER_THEMES } from "./theme-picker";

interface BinderSummary {
  _id: string;
  slug: string;
  name: string;
  description: string;
  type: "free" | "set-template";
  setTemplate: { game: string; set: string } | null;
  theme: string;
  coverPackPullId: string | null;
  isPublic: boolean;
  cardCount: number;
  pageCount: number;
  likeCount: number;
  viewCount: number;
  updatedAt: string;
}

interface BinderListViewProps {
  lang: string;
}

export function BinderListView({ lang }: BinderListViewProps) {
  const isDe = lang === "de";
  const [binders, setBinders] = useState<BinderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/binders")
      .then(async (res) => {
        if (!res.ok) throw new Error("fetch");
        return (await res.json()) as { binders: BinderSummary[] };
      })
      .then((data) => setBinders(data.binders))
      .catch(() =>
        setError(isDe ? "Konnte nicht laden." : "Could not load."),
      )
      .finally(() => setLoading(false));
  }, [isDe]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <BookOpen className="w-7 h-7 text-pa-green" />
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              {isDe ? "Deine Binder" : "Your binders"}
            </h1>
            <p className="text-sm text-text-secondary">
              {isDe
                ? "Sammelalben aus deiner Sammlung."
                : "Albums built from your collection."}
            </p>
          </div>
        </div>
        <Link
          href={`/${lang}/binders/new`}
          className="bg-pa-green text-bg font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-pa-green-hover inline-flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {isDe ? "Neuer Binder" : "New binder"}
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/${lang}/binders/explore`}
          className="text-sm text-text-secondary hover:text-text-primary inline-flex items-center gap-1.5"
        >
          <Globe className="w-4 h-4" />
          {isDe ? "Galerie entdecken" : "Discover gallery"}
        </Link>
      </div>

      {loading ? (
        <div className="py-16 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-pa-green mb-2" />
          <p className="text-sm text-text-muted">
            {isDe ? "Laden…" : "Loading…"}
          </p>
        </div>
      ) : error ? (
        <div className="py-16 text-center text-error">{error}</div>
      ) : binders.length === 0 ? (
        <div className="py-16 text-center">
          <BookOpen className="w-10 h-10 mx-auto text-text-muted mb-3" />
          <p className="text-text-muted mb-4">
            {isDe
              ? "Noch kein Binder. Leg deinen ersten an!"
              : "No binders yet. Start your first one!"}
          </p>
          <Link
            href={`/${lang}/binders/new`}
            className="bg-pa-green text-bg font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-pa-green-hover inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {isDe ? "Neuer Binder" : "New binder"}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {binders.map((b) => (
            <BinderTile key={b._id} binder={b} lang={lang} isDe={isDe} />
          ))}
        </div>
      )}
    </div>
  );
}

function BinderTile({
  binder,
  lang,
  isDe,
}: {
  binder: BinderSummary;
  lang: string;
  isDe: boolean;
}) {
  const theme =
    BINDER_THEMES.find((t) => t.key === binder.theme) ?? BINDER_THEMES[0];
  return (
    <Link
      href={`/${lang}/binders/${binder.slug}`}
      className="bg-surface border border-border rounded-xl overflow-hidden hover:border-pa-green/30 hover:-translate-y-1 transition-all duration-300 flex flex-col"
    >
      <div
        className={`relative h-40 ${theme.swatchClass} flex items-center justify-center`}
      >
        <BookOpen className="w-12 h-12 text-white/80" />
        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-black/60 text-white border border-white/15">
          {binder.type === "set-template"
            ? binder.setTemplate
              ? `${binder.setTemplate.game} · Set`
              : isDe
                ? "Set"
                : "Set"
            : isDe
              ? "Frei"
              : "Free"}
        </span>
        <span className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-black/60 text-white border border-white/15">
          {binder.isPublic ? (
            <>
              <Globe className="w-3 h-3" />
              {isDe ? "Öffentlich" : "Public"}
            </>
          ) : (
            <>
              <Lock className="w-3 h-3" />
              {isDe ? "Privat" : "Private"}
            </>
          )}
        </span>
      </div>
      <div className="p-4 space-y-1">
        <h3 className="text-base font-bold text-text-primary line-clamp-1">
          {binder.name}
        </h3>
        <p className="text-xs text-text-muted line-clamp-2 min-h-[2.4em]">
          {binder.description ||
            (isDe ? "Keine Beschreibung." : "No description.")}
        </p>
        <div className="flex items-center justify-between pt-2 text-xs text-text-secondary">
          <span className="inline-flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            {binder.cardCount} {isDe ? "Karten" : "cards"} · {binder.pageCount}{" "}
            {isDe ? "Seiten" : "pages"}
          </span>
          {binder.isPublic && binder.likeCount > 0 && (
            <span>♥ {binder.likeCount}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
