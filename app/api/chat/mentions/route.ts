import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getChatRoleBadgeLabel } from "@/lib/chat-constants";
import { escapeMentionRegex } from "@/lib/chat-mentions";
import connectDB from "@/lib/db";
import ChatMessage from "@/models/chat-message";
import User from "@/models/user";
import type { ChatMentionCandidateSummary, ChatMentionSearchResponse } from "@/types/chat";

export const dynamic = "force-dynamic";

function scoreMentionCandidate(
  candidate: { username: string },
  search: string,
  recentOrder: Map<string, number>
) {
  const username = candidate.username.toLowerCase();
  const query = search.toLowerCase();

  if (!query) {
    return recentOrder.get(candidate.username) ?? 1000;
  }
  if (username === query) return 0;
  if (username.startsWith(query)) return 1;
  if (username.includes(query)) return 2;
  return 3;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const query = new URL(req.url).searchParams.get("q")?.trim() ?? "";
    const recentMessages = await ChatMessage.find(
      {
        status: "visible",
        authorUserId: { $ne: null },
      },
      "authorUserId"
    )
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const recentIds = [
      ...new Set(
        recentMessages
          .map((message) => message.authorUserId?.toString())
          .filter((value): value is string => Boolean(value && value !== userId))
      ),
    ];
    const recentOrder = new Map<string, number>();

    let users;
    if (!query) {
      users = await User.find(
        {
          _id: { $in: recentIds },
          username: { $ne: null },
        },
        "username role"
      ).lean();
      if (users.length === 0) {
        users = await User.find(
          {
            _id: { $ne: userId },
            username: { $ne: null },
          },
          "username role"
        )
          .sort({ username: 1 })
          .limit(12)
          .lean();
      }
    } else {
      const regex = new RegExp(escapeMentionRegex(query), "i");
      users = await User.find(
        {
          _id: { $ne: userId },
          username: { $ne: null, $regex: regex },
        },
        "username role"
      )
        .limit(20)
        .lean();
    }

    if (!query) {
      recentIds.forEach((id, index) => {
        const user = users.find((candidate) => candidate._id.toString() === id);
        if (user?.username) {
          recentOrder.set(user.username, index);
        }
      });
    }

    const response: ChatMentionSearchResponse = {
      users: users
        .filter((candidate): candidate is typeof candidate & { username: string } => Boolean(candidate.username))
        .sort((a, b) => {
          const scoreDiff =
            scoreMentionCandidate(
              { username: a.username },
              query,
              recentOrder
            ) -
            scoreMentionCandidate(
              { username: b.username },
              query,
              recentOrder
            );

          if (scoreDiff !== 0) return scoreDiff;
          return a.username.localeCompare(b.username, "de", { sensitivity: "base" });
        })
        .slice(0, 8)
        .map(
          (candidate): ChatMentionCandidateSummary => ({
            userId: candidate._id.toString(),
            username: candidate.username,
            name: candidate.username,
            role: candidate.role,
            roleBadge: getChatRoleBadgeLabel(candidate.role),
          })
        ),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[chat mentions GET]", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
