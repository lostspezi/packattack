"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Swords, Loader2, RefreshCw } from "lucide-react";

import { BattleCreate } from "@/components/battles/battle-create";
import { BattleCard, type BattleCardData } from "@/components/battles/battle-card";
import { useToast } from "@/components/ui/toast";

interface BoxOption {
  _id: string;
  name: { de: string; en: string };
  game: string;
  image: string | null;
  battleFeePerRound: number;
}

export default function BattlesPage() {
  const params = useParams<{ lang: string }>();
  const lang = params.lang ?? "en";
  const isDe = lang === "de";
  const router = useRouter();
  const { toast } = useToast();

  const { data: session } = useSession();
  const currentUserId = session?.user?.id ?? "";

  const [boxes, setBoxes] = useState<BoxOption[]>([]);
  const [battles, setBattles] = useState<BattleCardData[]>([]);
  const [myBattles, setMyBattles] = useState<BattleCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const fetchLobby = useCallback(async () => {
    try {
      const [battlesRes, myRes, boxesRes] = await Promise.all([
        fetch("/api/battles?status=waiting"),
        fetch("/api/battles?status=mine"),
        fetch("/api/packs"),
      ]);

      if (battlesRes.ok) {
        const data = await battlesRes.json();
        setBattles(data.battles ?? []);
      }
      if (myRes.ok) {
        const data = await myRes.json();
        setMyBattles(data.battles ?? []);
      }
      if (boxesRes.ok) {
        const data = await boxesRes.json();
        const battleBoxes = (data.boxes ?? []).filter(
          (b: BoxOption & { battleFeePerRound?: number }) => b.battleFeePerRound && b.battleFeePerRound > 0,
        );
        setBoxes(battleBoxes);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLobby();
    const interval = setInterval(fetchLobby, 10000);
    return () => clearInterval(interval);
  }, [fetchLobby]);

  // Request notification permission for ready check alerts
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  function handleCreated(battle: { slug: string }) {
    router.push(`/${lang}/battles/${battle.slug}`);
  }

  async function handleJoin(battleIdOrSlug: string) {
    // If it's a slug (returning to own battle), navigate directly
    if (battleIdOrSlug.length === 8) {
      router.push(`/${lang}/battles/${battleIdOrSlug}`);
      return;
    }

    setJoiningId(battleIdOrSlug);
    try {
      const res = await fetch(`/api/battles/${battleIdOrSlug}/join`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error || "Error", type: "error" });
        return;
      }
      router.push(`/${lang}/battles/${data.battle.slug}`);
    } catch {
      toast({
        title: isDe ? "Fehler beim Beitreten" : "Error joining battle",
        type: "error",
      });
    } finally {
      setJoiningId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6">
      {/* Page Title */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-100">
          <Swords className="h-6 w-6 text-yellow-400" />
          {isDe ? "Battles" : "Battles"}
        </h1>
        <button
          onClick={() => { setLoading(true); fetchLobby(); }}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-all hover:border-zinc-600 hover:text-zinc-300"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {isDe ? "Aktualisieren" : "Refresh"}
        </button>
      </div>

      {/* Main Layout: Sidebar + Battle List */}
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Left: Create Panel */}
        <div className="w-full shrink-0 lg:w-[380px]">
          <BattleCreate boxes={boxes} lang={lang} onCreated={handleCreated} />
        </div>

        {/* Right: Battle Lists */}
        <div className="min-w-0 flex-1">
          {/* My Active Battles */}
          {myBattles.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-yellow-400">
                {isDe ? "Meine Battles" : "My Battles"}
              </h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {myBattles.map((battle) => (
                  <BattleCard
                    key={battle._id}
                    battle={battle}
                    lang={lang}
                    currentUserId={currentUserId}
                    onJoin={handleJoin}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Open Battles */}
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">
              {isDe ? "Offene Battles" : "Open Battles"}
              {battles.length > 0 && (
                <span className="ml-2 text-zinc-600">({battles.length})</span>
              )}
            </h2>

            {battles.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 py-16 text-center">
                <Swords className="mb-3 h-10 w-10 text-zinc-700" />
                <p className="text-sm text-zinc-500">
                  {isDe
                    ? "Keine offenen Battles. Erstelle das erste!"
                    : "No open battles. Create the first one!"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {battles.map((battle) => (
                  <BattleCard
                    key={battle._id}
                    battle={battle}
                    lang={lang}
                    currentUserId={currentUserId}
                    onJoin={handleJoin}
                    joining={joiningId === battle._id}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
