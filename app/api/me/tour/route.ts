import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import User from "@/models/user";
import {
  TOUR_DEFAULTS,
  TourPatchSchema,
  type TourState,
} from "@/lib/packi/tour-validation";

export const dynamic = "force-dynamic";

interface TourDoc {
  completed?: boolean;
  skippedAt?: Date | null;
  completedSteps?: string[];
  lastPromptAt?: Date | null;
  sessionCountSincePrompt?: number;
}

function normalize(tour: TourDoc | null | undefined): TourState {
  if (!tour) return { ...TOUR_DEFAULTS };
  return {
    completed: tour.completed ?? false,
    skippedAt: tour.skippedAt ? new Date(tour.skippedAt).toISOString() : null,
    completedSteps: Array.isArray(tour.completedSteps)
      ? [...tour.completedSteps]
      : [],
    lastPromptAt: tour.lastPromptAt
      ? new Date(tour.lastPromptAt).toISOString()
      : null,
    sessionCountSincePrompt: tour.sessionCountSincePrompt ?? 0,
  };
}

async function requireUserId(): Promise<string | NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!Types.ObjectId.isValid(userId)) {
    return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  }
  return userId;
}

export async function GET() {
  const userOrResponse = await requireUserId();
  if (userOrResponse instanceof NextResponse) return userOrResponse;

  try {
    await connectDB();
    const user = await User.findById(userOrResponse).select("tour").lean();
    if (!user) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json(normalize(user.tour));
  } catch (err) {
    console.error("[me/tour GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const userOrResponse = await requireUserId();
  if (userOrResponse instanceof NextResponse) return userOrResponse;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = TourPatchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const patch = parsed.data;

  const set: Record<string, unknown> = {};
  if (patch.completed !== undefined) set["tour.completed"] = patch.completed;
  if (patch.skippedAt !== undefined) set["tour.skippedAt"] = patch.skippedAt;
  if (patch.completedSteps !== undefined) {
    set["tour.completedSteps"] = patch.completedSteps;
  }
  if (patch.lastPromptAt !== undefined) set["tour.lastPromptAt"] = patch.lastPromptAt;
  if (patch.sessionCountSincePrompt !== undefined) {
    set["tour.sessionCountSincePrompt"] = patch.sessionCountSincePrompt;
  }

  const update: Record<string, unknown> = {};
  if (Object.keys(set).length > 0) update.$set = set;
  if (patch.addCompletedStep) {
    update.$addToSet = { "tour.completedSteps": patch.addCompletedStep };
  }
  if (patch.incrementSessionCount) {
    update.$inc = { "tour.sessionCountSincePrompt": 1 };
  }

  try {
    await connectDB();
    const updated = await User.findByIdAndUpdate(
      userOrResponse,
      update,
      { new: true, select: "tour" },
    ).lean();
    if (!updated) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json(normalize(updated.tour));
  } catch (err) {
    console.error("[me/tour PATCH]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
