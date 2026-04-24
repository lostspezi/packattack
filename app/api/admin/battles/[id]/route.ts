import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Battle from "@/models/battle";
import User from "@/models/user";
import { publishBattleEvent } from "@/lib/battle-events";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const user = await User.findById(session.user.id).select("role").lean();
    if (!user || (user.role !== "admin" && user.role !== "super_admin")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const battle = await Battle.findById(id);
    if (!battle) {
      return NextResponse.json({ error: "battle_not_found" }, { status: 404 });
    }

    if (battle.status === "finished" || battle.status === "cancelled") {
      return NextResponse.json({ error: "battle_already_ended" }, { status: 400 });
    }

    battle.status = "cancelled";
    await battle.save();
    await publishBattleEvent(id, "battle_cancelled", { reason: "admin_cancelled" });

    return NextResponse.json({ cancelled: true });
  } catch (err) {
    console.error("[admin/battles/[id]] DELETE error:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
