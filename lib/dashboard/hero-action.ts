import { Types } from "mongoose";
import connectDB from "@/lib/db";
import PackPull from "@/models/pack-pull";
import Battle from "@/models/battle";
import QuizEvent from "@/models/quiz-event";
import QuizParticipant from "@/models/quiz-participant";

export type HeroActionKind =
  | "pending_pulls"
  | "active_battle"
  | "active_quiz"
  | "default";

export interface HeroAction {
  kind: HeroActionKind;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string | null;
  secondaryHref: string | null;
  context: Record<string, unknown>;
}

export async function getHeroAction(userId: string): Promise<HeroAction> {
  await connectDB();
  const uid = new Types.ObjectId(userId);

  const [pendingCount, activeBattle, activeQuiz] = await Promise.all([
    PackPull.countDocuments({
      userId: uid,
      status: { $in: ["pending", "reserved"] },
    }),
    Battle.findOne({
      "players.user": uid,
      status: { $in: ["ready_check", "countdown", "active", "sudden_death"] },
    })
      .select("slug status")
      .lean(),
    QuizEvent.findOne({ status: "active" }).select("slug startsAt").lean(),
  ]);

  if (pendingCount > 0) {
    return {
      kind: "pending_pulls",
      primaryLabel: `${pendingCount} ${pendingCount === 1 ? "Pull" : "Pulls"} finalisieren`,
      primaryHref: "/cart",
      secondaryLabel: "Pack öffnen",
      secondaryHref: "/packs",
      context: { pendingCount },
    };
  }

  if (activeBattle) {
    return {
      kind: "active_battle",
      primaryLabel: "Battle fortsetzen",
      primaryHref: `/battles/${activeBattle.slug}`,
      secondaryLabel: "Pack öffnen",
      secondaryHref: "/packs",
      context: { battleSlug: activeBattle.slug },
    };
  }

  if (activeQuiz) {
    const myParticipation = await QuizParticipant.findOne({
      eventId: activeQuiz._id,
      userId: uid,
    })
      .select("status")
      .lean();
    const alreadyDone =
      myParticipation?.status === "completed";
    if (!alreadyDone) {
      return {
        kind: "active_quiz",
        primaryLabel: "Quiz beitreten",
        primaryHref: "/events",
        secondaryLabel: "Pack öffnen",
        secondaryHref: "/packs",
        context: { quizSlug: activeQuiz.slug },
      };
    }
  }

  return {
    kind: "default",
    primaryLabel: "Pack öffnen",
    primaryHref: "/packs",
    secondaryLabel: "Battles",
    secondaryHref: "/battles",
    context: {},
  };
}
