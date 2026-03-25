import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import User from "@/models/user";
import { MongoClient } from "mongodb";

const mongoClient = new MongoClient(process.env.MONGODB_URI!);

async function getDb() {
  await mongoClient.connect();
  return mongoClient.db();
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = await getDb();
    const accounts = await db
      .collection("accounts")
      .find({ userId: session.user.id })
      .toArray();

    const providers = accounts.map((a) => ({
      provider: a.provider as string,
      providerAccountId: a.providerAccountId as string,
    }));

    return NextResponse.json({ providers });
  } catch (err) {
    console.error("[account/link GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { provider } = body as { provider?: string };

    if (!provider) {
      return NextResponse.json({ error: "provider_required" }, { status: 400 });
    }

    await connectDB();
    const db = await getDb();

    const userId = session.user.id;

    // Count all linked accounts for this user
    const allAccounts = await db
      .collection("accounts")
      .find({ userId })
      .toArray();

    const user = await User.findById(userId).select("+password").lean();
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Ensure at least one login method remains
    const otherAccounts = allAccounts.filter((a) => a.provider !== provider);
    const hasPassword = !!user.password;

    if (!hasPassword && otherAccounts.length === 0) {
      return NextResponse.json(
        { error: "last_login_method" },
        { status: 400 }
      );
    }

    await db.collection("accounts").deleteOne({ userId, provider });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[account/link DELETE]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
