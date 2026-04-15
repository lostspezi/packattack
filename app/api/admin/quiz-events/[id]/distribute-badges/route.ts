import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import User from "@/models/user";
import QuizEvent from "@/models/quiz-event";
import QuizParticipant from "@/models/quiz-participant";
import { bulkGrantBadges } from "@/lib/badges";
import { quizBadgeDistributionSchema } from "@/lib/validations";

function isAdmin(role?: string | null) {
  return role === "admin" || role === "super_admin";
}

type RouteCtx = { params: Promise<{ id: string }> };

/** GET — preview: participant counts per placement category */
export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const user = await User.findById(session.user.id).select("role").lean();
    if (!user || !isAdmin(user.role)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const event = await QuizEvent.findById(id).lean();
    if (!event) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const participants = await QuizParticipant.find({
      eventId: event._id,
      status: "completed",
    })
      .select("userId placement")
      .lean();

    // Collect user IDs per category
    const categories: Record<string, string[]> = {
      "1": [],
      "2": [],
      "3": [],
      completed: [],
    };

    for (const p of participants) {
      const key =
        p.placement === 1 || p.placement === 2 || p.placement === 3
          ? String(p.placement)
          : "completed";
      categories[key].push(String(p.userId));
    }

    // Fetch user names for top-3
    const top3Ids = [
      ...categories["1"],
      ...categories["2"],
      ...categories["3"],
    ];
    const top3Users =
      top3Ids.length > 0
        ? await User.find({ _id: { $in: top3Ids } })
            .select("name username")
            .lean()
        : [];
    const userMap = new Map(
      top3Users.map((u) => [String(u._id), { name: u.name, username: u.username }]),
    );

    const preview = {
      "1": {
        count: categories["1"].length,
        users: categories["1"].map((id) => userMap.get(id) ?? { name: "Unknown" }),
      },
      "2": {
        count: categories["2"].length,
        users: categories["2"].map((id) => userMap.get(id) ?? { name: "Unknown" }),
      },
      "3": {
        count: categories["3"].length,
        users: categories["3"].map((id) => userMap.get(id) ?? { name: "Unknown" }),
      },
      completed: {
        count: categories.completed.length,
        users: [],
      },
    };

    return NextResponse.json({
      preview,
      totalCompleted: participants.length,
      alreadyDistributed: !!event.badgesDistributedAt,
      distributedAt: event.badgesDistributedAt ?? null,
    });
  } catch (err) {
    console.error("[distribute-badges GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

/** POST — distribute badges to all completed participants */
export async function POST(req: NextRequest, { params }: RouteCtx) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const user = await User.findById(session.user.id).select("role").lean();
    if (!user || !isAdmin(user.role)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = quizBadgeDistributionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_input", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { mappings, force } = parsed.data;
    const { id } = await params;
    const event = await QuizEvent.findById(id);
    if (!event) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    if (event.status !== "ended") {
      return NextResponse.json(
        { error: "event_not_ended" },
        { status: 400 },
      );
    }

    if (event.badgesDistributedAt && !force) {
      return NextResponse.json(
        {
          error: "already_distributed",
          distributedAt: event.badgesDistributedAt,
        },
        { status: 409 },
      );
    }

    const participants = await QuizParticipant.find({
      eventId: event._id,
      status: "completed",
    })
      .select("userId placement")
      .lean();

    // Build mapping lookup: placement → badgeKey
    const mappingByPlacement = new Map<number | "completed", string>();
    for (const m of mappings) {
      mappingByPlacement.set(m.placement, m.badgeKey);
    }

    const eventTitle = event.title.de || event.title.en;
    const grants = participants
      .map((p) => {
        const placement =
          p.placement === 1 || p.placement === 2 || p.placement === 3
            ? p.placement
            : ("completed" as const);
        const badgeKey = mappingByPlacement.get(placement);
        if (!badgeKey) return null;
        return {
          userId: String(p.userId),
          badgeKey,
          awardReason: `Quiz-Event: ${eventTitle}`,
        };
      })
      .filter((g): g is NonNullable<typeof g> => g !== null);

    const results = await bulkGrantBadges({
      grants,
      awardedByUserId: session.user.id,
    });

    event.badgesDistributedAt = new Date();
    await event.save();

    return NextResponse.json({
      success: true,
      results,
      distributedAt: event.badgesDistributedAt,
    });
  } catch (err) {
    console.error("[distribute-badges POST]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
