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

    const seasons = await Season.find()
      .sort({ number: -1 })
      .lean();

    return NextResponse.json({ seasons });
  } catch (err) {
    console.error("[seasons] GET error:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
