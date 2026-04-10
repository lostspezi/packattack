import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import User from "@/models/user";
import QuizEvent from "@/models/quiz-event";
import QuizParticipant from "@/models/quiz-participant";
import { getUserBadgeSummariesForUsers } from "@/lib/badges";

/** POST — join the current event (waitlist). Requires beta badge. */
export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const user = await User.findById(session.user.id).select("role").lean();
    const isAdmin = user?.role === "admin" || user?.role === "super_admin";
    const statusFilter = isAdmin
      ? ["active", "upcoming", "draft"]
      : ["active", "upcoming"];

    const event = await QuizEvent.findOne({
      status: { $in: statusFilter },
    })
      .sort({ status: 1, startsAt: 1 })
      .lean();

    if (!event) {
      return NextResponse.json(
        { error: "no_active_event" },
        { status: 404 },
      );
    }

    // Check if already joined
    const existing = await QuizParticipant.findOne({
      eventId: event._id,
      userId: session.user.id,
    }).lean();

    if (existing) {
      return NextResponse.json(
        { error: "already_joined", participant: { status: existing.status } },
        { status: 409 },
      );
    }

    // Check required badge (admins bypass for testing)
    if (event.requiredBadgeKey && !isAdmin) {
      const badgeMap = await getUserBadgeSummariesForUsers([session.user.id]);
      const userBadges = badgeMap.get(session.user.id) ?? [];
      const hasBadge = userBadges.some((b) => b.key === event.requiredBadgeKey);

      if (!hasBadge) {
        return NextResponse.json(
          {
            error: "badge_required",
            requiredBadge: event.requiredBadgeKey,
            message: "Du benötigst das Beta-Tester Badge, um teilzunehmen.",
          },
          { status: 403 },
        );
      }
    }

    // Determine initial status based on event state
    const status = event.status === "active" ? "active" : "waitlisted";

    const participant = await QuizParticipant.create({
      eventId: event._id,
      userId: session.user.id,
      status,
      joinedAt: new Date(),
    });

    return NextResponse.json(
      {
        participant: {
          _id: String(participant._id),
          status: participant.status,
          joinedAt: participant.joinedAt,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    // Handle duplicate key (race condition)
    if ((err as { code?: number }).code === 11000) {
      return NextResponse.json(
        { error: "already_joined" },
        { status: 409 },
      );
    }
    console.error("[events/current/join] POST error:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
