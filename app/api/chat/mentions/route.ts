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
  candidate: { username: string; name: string },
  search: string,
  recentOrder: Map<string, number>
) {
  const username = candidate.username.toLowerCase();
  const name = candidate.name.toLowerCase();
  const query = search.toLowerCase();

  if (!query) {
    return recentOrder.get(candidate.username) ?? 1000;
  }
  if (username === query) return 0;
  if (username.startsWith(query)) return 1;
  if (name.startsWith(query)) return 2;
  if (username.includes(query)) return 3;
  if (name.includes(query)) return 4;
  return 5;
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
        "name username role"
      ).lean();
      if (users.length === 0) {
        users = await User.find(
          {
            _id: { $ne: userId },
            username: { $ne: null },
          },
          "name username role"
        )
          .sort({ username: 1, name: 1 })
          .limit(12)
          .lean();
      }
    } else {
      const regex = new RegExp(escapeMentionRegex(query), "i");
      users = await User.find(
        {
          _id: { $ne: userId },
          username: { $ne: null },
          $or: [{ username: regex }, { name: regex }],
        },
        "name username role"
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
              { username: a.username, name: a.name ?? a.username },
              query,
              recentOrder
            ) -
            scoreMentionCandidate(
              { username: b.username, name: b.name ?? b.username },
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
            name: candidate.name?.trim() || candidate.username,
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
