"use client";

import { useEffect, useState } from "react";

interface CosmeticsResponse {
  availableTitles: string[];
  equippedTitle: string | null;
  displayTitle: string | null;
}

export function TitlePicker({ lang }: { lang: string }) {
  const isDe = lang === "de";
  const [data, setData] = useState<CosmeticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/me/cosmetics", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as CosmeticsResponse;
        if (!cancelled) setData(json);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const apply = async (next: string | null) => {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/me/cosmetics", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ equippedTitle: next }),
      });
      if (!res.ok) {
        setFeedback(isDe ? "Speichern fehlgeschlagen." : "Save failed.");
        return;
      }
      const refreshed = await fetch("/api/me/cosmetics", { cache: "no-store" });
      if (refreshed.ok) {
        const json = (await refreshed.json()) as CosmeticsResponse;
        setData(json);
        setFeedback(isDe ? "Gespeichert." : "Saved.");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-text-muted">{isDe ? "Lädt…" : "Loading…"}</p>;
  }

  if (!data || data.availableTitles.length === 0) {
    return (
      <p className="text-sm text-text-muted">
        {isDe
          ? "Du hast noch keine Titel freigeschaltet. Schließe Achievements ab, um Titel zu sammeln."
          : "You haven't unlocked any titles yet. Complete achievements to earn titles."}
      </p>
    );
  }

  const equipped = data.equippedTitle;
  const display = data.displayTitle;
  const usingFallback = !equipped && display !== null;

  return (
    <div className="space-y-3">
      <p className="text-xs text-text-muted">
        {isDe
          ? "Wähle, welcher Titel im Header und in deinem Profil angezeigt wird."
          : "Pick which title appears in the header and on your profile."}
      </p>

      <div className="space-y-1">
        <button
          type="button"
          disabled={saving}
          onClick={() => apply(null)}
          className={`w-full text-left rounded border px-3 py-2 text-sm transition-colors ${
            equipped === null
              ? "border-pa-green bg-pa-green/10 text-text-primary"
              : "border-border bg-surface hover:border-pa-green/40 text-text-primary"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span>
              {isDe ? "Kein Titel" : "No title"}
              {equipped === null && usingFallback && (
                <span className="ml-2 text-xs text-text-muted">
                  ({isDe ? "neuester wird angezeigt" : "newest is shown"})
                </span>
              )}
            </span>
            {equipped === null && !usingFallback && (
              <span className="text-xs text-pa-green">✓</span>
            )}
          </div>
        </button>

        {data.availableTitles.map((title) => {
          const active = equipped === title;
          const isFallbackActive = !equipped && display === title;
          return (
            <button
              key={title}
              type="button"
              disabled={saving}
              onClick={() => apply(title)}
              className={`w-full text-left rounded border px-3 py-2 text-sm transition-colors ${
                active
                  ? "border-pa-green bg-pa-green/10 text-text-primary"
                  : "border-border bg-surface hover:border-pa-green/40 text-text-primary"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span>{title}</span>
                {active ? (
                  <span className="text-xs text-pa-green">✓</span>
                ) : isFallbackActive ? (
                  <span className="text-xs text-text-muted">
                    {isDe ? "aktuell" : "current"}
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      {feedback && <p className="text-xs text-text-muted">{feedback}</p>}
    </div>
  );
}
