import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import User from "@/models/user";
import CartItem from "@/models/cart-item";
import PackPull from "@/models/pack-pull";
import QuizEvent from "@/models/quiz-event";

/**
 * Consolidated dashboard-header snapshot. Replaces the five parallel
 * requests (profile, cart, pulls/pending summary, events/current,
 * notifications-count) that every dashboard page used to fire on mount.
 * Keeps payloads small — clients still hit the dedicated endpoints for
 * full detail views (cart items, pending cards, etc.).
 */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const [user, cartItems, hasPending, currentEvent] = await Promise.all([
      User.findById(userId).select("coins role").lean(),
      CartItem.find({ userId, status: "reserved" })
        .select("expiresAt")
        .lean(),
      PackPull.exists({ userId, status: "pending" }),
      QuizEvent.findOne({ status: { $in: ["active", "upcoming"] } })
        .select("startsAt status")
        .sort({ status: 1, startsAt: 1 })
        .lean(),
    ]);

    const now = Date.now();
    const remainingSecondsByItem = cartItems.map((item) =>
      Math.max(
        0,
        Math.floor((new Date(item.expiresAt).getTime() - now) / 1000),
      ),
    );
    const cartExpiresInSeconds =
      remainingSecondsByItem.length > 0 ? Math.min(...remainingSecondsByItem) : 0;

    return NextResponse.json({
      coins: user?.coins ?? 0,
      role: user?.role ?? "user",
      cart: {
        totalItems: cartItems.length,
        cartExpiresInSeconds,
      },
      pending: { exists: Boolean(hasPending) },
      event: currentEvent
        ? {
            startsAt: new Date(currentEvent.startsAt).toISOString(),
            status: currentEvent.status,
          }
        : null,
    });
  } catch (err) {
    console.error("[me GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
