import Link from "next/link";
import { cache } from "react";
import { Types } from "mongoose";
import { Swords, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import connectDB from "@/lib/db";
import Battle from "@/models/battle";
import QuizEvent from "@/models/quiz-event";

interface DashboardLiveSidebarProps {
  lang: string;
  userId: string;
}

interface SidebarData {
  activeBattles: { slug: string; status: string; playerCount: number }[];
  activeQuiz: { slug: string; title: string; startsAt: string } | null;
}

const EMPTY_DATA: SidebarData = { activeBattles: [], activeQuiz: null };

const loadSidebarData = cache(async (userId: string): Promise<SidebarData> => {
  try {
    await connectDB();
    const uid = new Types.ObjectId(userId);

    const [battles, quiz] = await Promise.all([
      Battle.find({
        "players.user": uid,
        status: { $in: ["waiting", "ready_check", "countdown", "active", "sudden_death"] },
      })
        .sort({ updatedAt: -1 })
        .limit(3)
        .select("slug status players")
        .lean(),
      QuizEvent.findOne({ status: "active" })
        .select("slug title startsAt")
        .lean(),
    ]);

    return {
      activeBattles: battles.map((b) => ({
        slug: b.slug,
        status: b.status,
        playerCount: b.players?.length ?? 0,
      })),
      activeQuiz: quiz
        ? {
            slug: quiz.slug,
            title:
              typeof quiz.title === "string"
                ? quiz.title
                : (quiz.title?.de ?? quiz.slug),
            startsAt: quiz.startsAt.toISOString(),
          }
        : null,
    };
  } catch (err) {
    console.error("[dashboard-live-sidebar] loadSidebarData failed:", err);
    return EMPTY_DATA;
  }
});

const STATUS_LABEL: Record<string, string> = {
  waiting: "Wartet auf Spieler",
  ready_check: "Ready-Check",
  countdown: "Countdown",
  active: "Aktiv",
  sudden_death: "Sudden Death",
};

export async function DashboardLiveSidebar({ lang, userId }: DashboardLiveSidebarProps) {
  const data = await loadSidebarData(userId);

  return (
    <div className="space-y-4">
      {/* Active Battles */}
      <Card variant="soft" className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Swords className="w-4 h-4 text-pa-green" />
          <h4 className="text-text-primary font-semibold text-sm">
            Deine Battles
          </h4>
        </div>
        {data.activeBattles.length === 0 ? (
          <p className="text-text-muted text-xs">
            Keine offenen Battles. <Link href={`/${lang}/battles`} className="text-pa-green hover:underline">Eins starten?</Link>
          </p>
        ) : (
          <ul className="space-y-2">
            {data.activeBattles.map((b) => (
              <li key={b.slug}>
                <Link
                  href={`/${lang}/battles/${b.slug}`}
                  className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-white/4 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-text-primary text-sm font-medium truncate">
                      {b.slug}
                    </p>
                    <p className="text-text-muted text-xs">
                      {STATUS_LABEL[b.status] ?? b.status} · {b.playerCount} Spieler
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Active Quiz */}
      {data.activeQuiz && (
        <Card variant="topline" className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-pa-green" />
            <h4 className="text-text-primary font-semibold text-sm">
              Quiz läuft
            </h4>
          </div>
          <p className="text-text-primary text-sm font-medium mb-1">
            {data.activeQuiz.title}
          </p>
          <Link
            href={`/${lang}/events`}
            className="text-pa-green text-xs font-medium hover:underline"
          >
            Beitreten →
          </Link>
        </Card>
      )}
    </div>
  );
}
