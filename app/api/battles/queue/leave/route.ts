import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import BattleQueue from "@/models/battle-queue";

export async function DELETE() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const result = await BattleQueue.updateOne(
      { user: userId, status: "waiting" },
      { $set: { status: "cancelled" } },
    );

    return NextResponse.json({ left: result.modifiedCount > 0 });
  } catch (err) {
    console.error("[queue/leave DELETE]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
