import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Season from "@/models/season";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const season = await Season.findOne({ status: "active" }).lean();

    if (!season) {
      return NextResponse.json({ season: null });
    }

    const daysRemaining = Math.max(
      0,
      Math.ceil((new Date(season.endsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
    );

    return NextResponse.json({ season, daysRemaining });
  } catch (err) {
    console.error("[seasons/current] GET error:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
