import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import User from "@/models/user";
import QuizEvent from "@/models/quiz-event";
import QuizParticipant from "@/models/quiz-participant";

/** POST — leave the waitlist for the current event */
export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const dbUser = await User.findById(session.user.id).select("role").lean();
    const isAdmin = dbUser?.role === "admin" || dbUser?.role === "super_admin";
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

    const participant = await QuizParticipant.findOne({
      eventId: event._id,
      userId: session.user.id,
    });

    if (!participant) {
      return NextResponse.json(
        { error: "not_joined" },
        { status: 404 },
      );
    }

    // Only allow leaving from waitlist — can't leave once quiz has started
    if (participant.status !== "waitlisted") {
      return NextResponse.json(
        {
          error: "cannot_leave",
          message: "Du kannst dich nur abmelden, solange das Quiz noch nicht gestartet ist.",
        },
        { status: 400 },
      );
    }

    await participant.deleteOne();

    return NextResponse.json({ left: true });
  } catch (err) {
    console.error("[events/current/leave] POST error:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
