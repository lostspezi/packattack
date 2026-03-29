import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import BattleQueue from "@/models/battle-queue";
import Battle from "@/models/battle";

export async function GET() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const entry = await BattleQueue.findOne({
      user: userId,
      status: "waiting",
    }).lean();

    if (!entry) {
      const matchedEntry = await BattleQueue.findOne({
        user: userId,
        status: "matched",
      })
        .sort({ updatedAt: -1 })
        .lean();

      if (matchedEntry) {
        const battle = await Battle.findOne({
          "players.user": userId,
          status: { $in: ["waiting", "ready_check", "countdown"] },
        })
          .select("slug status")
          .lean();

        return NextResponse.json({
          inQueue: false,
          matched: true,
          battle: battle ? { slug: battle.slug, status: battle.status } : null,
        });
      }

      return NextResponse.json({ inQueue: false, matched: false });
    }

    const waitMs = Date.now() - new Date(entry.queuedAt).getTime();

    return NextResponse.json({
      inQueue: true,
      matched: false,
      queueId: entry._id.toString(),
      queuedAt: entry.queuedAt,
      waitSeconds: Math.floor(waitMs / 1000),
    });
  } catch (err) {
    console.error("[queue/status GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
