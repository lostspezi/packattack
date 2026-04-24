import { NextResponse, NextRequest } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import User from "@/models/user";
import FairnessSeed from "@/models/fairness-seed";
import PackOpenCommitment from "@/models/pack-open-commitment";

function isAdminRole(role?: string | null) {
  return role === "admin" || role === "super_admin";
}

const COMMITMENTS_PAGE_SIZE = 50;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role ?? null;
  if (!session?.user || !isAdminRole(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await params;
  if (!Types.ObjectId.isValid(userId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const skip = parseInt(new URL(req.url).searchParams.get("skip") ?? "0", 10) || 0;

  try {
    await connectDB();

    const userObjectId = new Types.ObjectId(userId);
    const [user, seeds, commitments, totalCommitments] = await Promise.all([
      User.findById(userObjectId)
        .select("_id username email fairnessClientSeed fairnessInitializedAt")
        .lean(),
      FairnessSeed.find({ userId: userObjectId })
        .select("_id status serverSeedHash nonce activatedAt revealedAt replacedBySeedId")
        .sort({ activatedAt: -1 })
        .lean(),
      PackOpenCommitment.find({ userId: userObjectId })
        .select("_id packGroupId boxId nonceStart nonceEnd poolHash serverSeedId createdAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(COMMITMENTS_PAGE_SIZE)
        .lean(),
      PackOpenCommitment.countDocuments({ userId: userObjectId }),
    ]);

    if (!user) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        clientSeed: user.fairnessClientSeed ?? null,
        initializedAt: user.fairnessInitializedAt ?? null,
      },
      seeds: seeds.map((s) => ({
        id: s._id.toString(),
        status: s.status,
        serverSeedHash: s.serverSeedHash,
        nonce: s.nonce,
        activatedAt: s.activatedAt,
        revealedAt: s.revealedAt,
        replacedBySeedId: s.replacedBySeedId?.toString() ?? null,
      })),
      commitments: commitments.map((c) => ({
        id: c._id.toString(),
        packGroupId: c.packGroupId,
        boxId: c.boxId.toString(),
        serverSeedId: c.serverSeedId.toString(),
        nonceStart: c.nonceStart,
        nonceEnd: c.nonceEnd,
        poolHash: c.poolHash,
        createdAt: c.createdAt,
      })),
      totalCommitments,
      page: { skip, size: COMMITMENTS_PAGE_SIZE },
    });
  } catch (err) {
    console.error("[admin/fairness/users GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
