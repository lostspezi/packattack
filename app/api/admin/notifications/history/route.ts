import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Notification from "@/models/notification";

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await connectDB();

    // Group by title + type, get last 20 distinct groups
    const aggregation = await Notification.aggregate([
      {
        $sort: { createdAt: -1 },
      },
      {
        $group: {
          _id: { title: "$title", type: "$type" },
          latestId: { $first: "$_id" },
          createdAt: { $first: "$createdAt" },
          count: { $sum: 1 },
        },
      },
      { $sort: { createdAt: -1 } },
      { $limit: 20 },
    ]);

    const items = aggregation.map((item) => ({
      _id: item.latestId.toString(),
      title: item._id.title as string,
      type: item._id.type as string,
      createdAt: item.createdAt as Date,
      count: item.count as number,
    }));

    return NextResponse.json({ items });
  } catch (err) {
    console.error("[admin/notifications/history GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
