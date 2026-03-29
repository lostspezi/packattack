import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import {
  appendChatArchiveEvent,
  buildChatPermissions,
  ensureChatUserState,
  ensureGlobalChatPolicy,
  ensureGlobalChatRoom,
  publishRoomEvent,
  serializeChatMessage,
} from "@/lib/chat";
import { isChatStaff } from "@/lib/chat-constants";
import connectDB from "@/lib/db";
import { toggleChatReactionSchema } from "@/lib/validations";
import ChatMessage from "@/models/chat-message";
import User from "@/models/user";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = toggleChatReactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const { messageId } = await params;
    if (!Types.ObjectId.isValid(messageId)) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    await connectDB();
    const user = await User.findById(userId).lean();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const normalizedUser = { ...user, role: user.role ?? "user" };
    const [room, policy, userState] = await Promise.all([
      ensureGlobalChatRoom(),
      ensureGlobalChatPolicy(),
      ensureChatUserState(normalizedUser as never),
    ]);
    const permissions = buildChatPermissions({
      user: normalizedUser as never,
      room,
      userState,
      moderationReady: policy.provider !== "none",
    });

    if (
      room.requireEmailVerifiedToPost &&
      !normalizedUser.emailVerified &&
      !isChatStaff(normalizedUser.role)
    ) {
      return NextResponse.json({ error: "not_verified" }, { status: 403 });
    }
    if (permissions.chatStatus === "banned") {
      return NextResponse.json({ error: "banned" }, { status: 403 });
    }
    if (permissions.chatStatus === "timed_out") {
      return NextResponse.json(
        { error: "timeout_active", timeoutUntil: permissions.timeoutUntil },
        { status: 403 }
      );
    }
    if (!permissions.moderationReady && !isChatStaff(normalizedUser.role)) {
      return NextResponse.json({ error: "moderation_unavailable" }, { status: 503 });
    }
    if (room.mode === "read_only") {
      return NextResponse.json({ error: "read_only" }, { status: 403 });
    }
    if (room.mode === "announcement_only" && !isChatStaff(normalizedUser.role)) {
      return NextResponse.json({ error: "announcement_only" }, { status: 403 });
    }

    const emoji = parsed.data.emoji;
    const reactorId = new Types.ObjectId(userId);
    const updatedMessage = await ChatMessage.findOneAndUpdate(
      {
        _id: new Types.ObjectId(messageId),
        roomId: room._id,
        status: "visible",
      },
      [
        {
          $set: {
            updatedAt: "$$NOW",
            reactions: {
              $let: {
                vars: {
                  currentReactions: { $ifNull: ["$reactions", []] },
                },
                in: {
                  $let: {
                    vars: {
                      hasExistingReaction: {
                        $gt: [
                          {
                            $size: {
                              $filter: {
                                input: "$$currentReactions",
                                as: "reaction",
                                cond: { $eq: ["$$reaction.emoji", emoji] },
                              },
                            },
                          },
                          0,
                        ],
                      },
                    },
                    in: {
                      $cond: [
                        "$$hasExistingReaction",
                        {
                          $map: {
                            input: "$$currentReactions",
                            as: "reaction",
                            in: {
                              $cond: [
                                { $eq: ["$$reaction.emoji", emoji] },
                                {
                                  emoji,
                                  userIds: {
                                    $let: {
                                      vars: {
                                        existingUserIds: {
                                          $ifNull: ["$$reaction.userIds", []],
                                        },
                                        hasReacted: {
                                          $in: [
                                            reactorId,
                                            { $ifNull: ["$$reaction.userIds", []] },
                                          ],
                                        },
                                      },
                                      in: {
                                        $cond: [
                                          "$$hasReacted",
                                          {
                                            $filter: {
                                              input: "$$existingUserIds",
                                              as: "existingUserId",
                                              cond: { $ne: ["$$existingUserId", reactorId] },
                                            },
                                          },
                                          {
                                            $cond: [
                                              { $gt: [{ $size: "$$existingUserIds" }, 0] },
                                              { $setUnion: ["$$existingUserIds", [reactorId]] },
                                              [reactorId],
                                            ],
                                          },
                                        ],
                                      },
                                    },
                                  },
                                },
                                "$$reaction",
                              ],
                            },
                          },
                        },
                        {
                          $concatArrays: [
                            "$$currentReactions",
                            [
                              {
                                emoji,
                                userIds: [reactorId],
                              },
                            ],
                          ],
                        },
                      ],
                    },
                  },
                },
              },
            },
          },
        },
        {
          $set: {
            reactions: {
              $filter: {
                input: "$reactions",
                as: "reaction",
                cond: { $gt: [{ $size: "$$reaction.userIds" }, 0] },
              },
            },
          },
        },
      ] as never,
      { returnDocument: "after", updatePipeline: true }
    );

    if (!updatedMessage) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const serializedMessage = serializeChatMessage(updatedMessage);
    const updatedReaction = serializedMessage.reactions.find((reaction) => reaction.emoji === emoji);
    const action = updatedReaction?.userIds.includes(userId) ? "added" : "removed";

    await appendChatArchiveEvent({
      roomId: room._id,
      roomSlug: room.slug,
      eventType: "message_reacted",
      messageId: updatedMessage._id,
      submissionSeq: updatedMessage.submissionSeq,
      actorUserId: normalizedUser._id,
      payload: {
        emoji,
        action,
        totalReactions: serializedMessage.reactions.reduce(
          (total, reaction) => total + reaction.count,
          0
        ),
      },
    });

    await publishRoomEvent(room.slug, {
      type: "message_updated",
      payload: {
        message: serializedMessage,
      },
    });

    return NextResponse.json({ message: serializedMessage, action });
  } catch (error) {
    console.error("[chat reactions POST]", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
