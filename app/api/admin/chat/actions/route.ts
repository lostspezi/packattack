import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { adminChatActionSchema } from "@/lib/validations";
import {
  appendChatArchiveEvent,
  ensureChatUserState,
  ensureGlobalChatRoom,
  publishRoomEvent,
  publishRoomState,
  publishUserEvent,
  serializeChatMessageWithCurrentRelations,
} from "@/lib/chat";
import { isChatStaff } from "@/lib/chat-constants";
import ChatMessage from "@/models/chat-message";
import ChatModerationAction from "@/models/chat-moderation-action";
import ChatReport from "@/models/chat-report";
import ChatRoom from "@/models/chat-room";
import User from "@/models/user";

function actorSnapshot(user: {
  name?: string | null;
  username?: string | null;
  role?: string | null;
}) {
  return {
    name: user.name ?? user.username ?? "Admin",
    username: user.username ?? null,
    role: user.role ?? "admin",
  };
}

function targetUserSnapshot(user: {
  name?: string | null;
  username?: string | null;
  email?: string | null;
}) {
  return {
    name: user.name ?? user.username ?? "Nutzer",
    username: user.username ?? null,
    email: user.email ?? null,
  };
}

function sourceMessageSnapshot(message: {
  _id: Types.ObjectId;
  bodyDisplay: string;
  visibleSeq?: number | null;
  authorSnapshot?: { name?: string | null } | null;
}) {
  return {
    messageId: message._id,
    body: message.bodyDisplay,
    visibleSeq: message.visibleSeq ?? null,
    authorName: message.authorSnapshot?.name ?? null,
  };
}

function activeRestrictionSnapshot(input: {
  sourceMessageId?: Types.ObjectId | null;
  sourceMessageBody?: string | null;
  sourceVisibleSeq?: number | null;
}) {
  return {
    messageId: input.sourceMessageId ?? null,
    body: input.sourceMessageBody ?? null,
    visibleSeq: input.sourceVisibleSeq ?? null,
    authorName: null,
  };
}

function normalizeLiftAction(action: string) {
  if (action === "unban_user") return "lift_ban";
  if (action === "unshadow_mute_user") return "lift_shadow_mute";
  return action;
}

function findReversalActionType(action: string) {
  switch (action) {
    case "lift_timeout":
      return "timeout_user";
    case "lift_ban":
      return "ban_user";
    case "lift_shadow_mute":
      return "shadow_mute_user";
    default:
      return null;
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  const userRole = session?.user?.role ?? null;
  if (!userId || !isChatStaff(userRole)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = adminChatActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    await connectDB();
    const [room, actor] = await Promise.all([
      ensureGlobalChatRoom(),
      User.findById(userId).lean(),
    ]);

    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const actionData = parsed.data;
    const normalizedAction = normalizeLiftAction(actionData.action);
    let createdActionId = null as string | null;
    let moderationUpdateKind: string | null = null;

    const createAction = async (input: {
      targetType: "message" | "user" | "room";
      targetMessageId?: string | Types.ObjectId | null;
      targetUserId?: string | Types.ObjectId | null;
      actionType: typeof normalizedAction;
      reasonCode: string;
      reasonText?: string | null;
      durationSeconds?: number | null;
      expiresAt?: Date | null;
      targetUserSnapshot?: {
        name?: string | null;
        username?: string | null;
        email?: string | null;
      } | null;
      sourceMessageSnapshot?: {
        messageId?: Types.ObjectId | null;
        body?: string | null;
        visibleSeq?: number | null;
        authorName?: string | null;
      } | null;
      reversalOfActionId?: Types.ObjectId | null;
      metadata?: Record<string, unknown> | null;
    }) => {
      const action = await ChatModerationAction.create({
        roomId: room._id,
        roomSlug: room.slug,
        targetType: input.targetType,
        targetMessageId: input.targetMessageId ?? null,
        targetUserId: input.targetUserId ?? null,
        actionType: input.actionType,
        reasonCode: input.reasonCode,
        reasonText: input.reasonText ?? null,
        durationSeconds: input.durationSeconds ?? null,
        expiresAt: input.expiresAt ?? null,
        actorUserId: actor._id,
        actorSnapshot: actorSnapshot(actor),
        targetUserSnapshot: input.targetUserSnapshot
          ? targetUserSnapshot(input.targetUserSnapshot)
          : null,
        sourceMessageSnapshot: input.sourceMessageSnapshot
          ? {
              messageId: input.sourceMessageSnapshot.messageId ?? null,
              body: input.sourceMessageSnapshot.body ?? null,
              visibleSeq: input.sourceMessageSnapshot.visibleSeq ?? null,
              authorName: input.sourceMessageSnapshot.authorName ?? null,
            }
          : null,
        reversalOfActionId: input.reversalOfActionId ?? null,
        metadata: input.metadata ?? null,
      });
      createdActionId = action._id.toString();
      return action;
    };

    switch (normalizedAction) {
      case "approve_message": {
        if (!actionData.messageId) {
          return NextResponse.json({ error: "message_required" }, { status: 400 });
        }
        const message = await ChatMessage.findById(actionData.messageId);
        if (!message || message.status !== "held") {
          return NextResponse.json({ error: "not_found" }, { status: 404 });
        }

        const updatedRoom = await ChatRoom.findByIdAndUpdate(
          room._id,
          {
            $inc: { visibleSeq: 1 },
            $set: { lastVisibleMessageAt: new Date(), lastVisibleMessageId: message._id },
          },
          { returnDocument: "after" }
        );

        if (!updatedRoom) {
          return NextResponse.json({ error: "server_error" }, { status: 500 });
        }

        message.status = "visible";
        message.visibleSeq = updatedRoom.visibleSeq;
        await message.save();

        const action = await createAction({
          targetType: "message",
          targetMessageId: message._id,
          targetUserId: message.authorUserId ?? null,
          actionType: "approve_message",
          reasonCode: "manual_approval",
          reasonText: actionData.reason ?? null,
          sourceMessageSnapshot: sourceMessageSnapshot(message),
        });

        await appendChatArchiveEvent({
          roomId: room._id,
          eventType: "message_visible",
          messageId: message._id,
          submissionSeq: message.submissionSeq,
          actorUserId: actor._id,
          payload: { actionId: action._id.toString(), reason: actionData.reason ?? null },
        });

        const serializedMessage = await serializeChatMessageWithCurrentRelations(message);
        await publishRoomEvent(room.slug, {
          type: "message_created",
          payload: { message: serializedMessage },
        });
        moderationUpdateKind = "message_reviewed";
        break;
      }
      case "reject_message": {
        if (!actionData.messageId) {
          return NextResponse.json({ error: "message_required" }, { status: 400 });
        }
        const message = await ChatMessage.findById(actionData.messageId);
        if (!message || message.status !== "held") {
          return NextResponse.json({ error: "not_found" }, { status: 404 });
        }
        message.status = "blocked";
        await message.save();

        const action = await createAction({
          targetType: "message",
          targetMessageId: message._id,
          targetUserId: message.authorUserId ?? null,
          actionType: "reject_message",
          reasonCode: "manual_reject",
          reasonText: actionData.reason ?? null,
          sourceMessageSnapshot: sourceMessageSnapshot(message),
        });

        await appendChatArchiveEvent({
          roomId: room._id,
          eventType: "message_blocked",
          messageId: message._id,
          submissionSeq: message.submissionSeq,
          actorUserId: actor._id,
          payload: { actionId: action._id.toString(), reason: actionData.reason ?? null },
        });

        if (message.authorUserId) {
          await publishUserEvent(message.authorUserId.toString(), {
            type: "user_notice",
            payload: { kind: "message_rejected", reason: actionData.reason ?? null },
          });
        }
        moderationUpdateKind = "message_reviewed";
        break;
      }
      case "delete_message":
      case "restore_message": {
        if (!actionData.messageId) {
          return NextResponse.json({ error: "message_required" }, { status: 400 });
        }
        const message = await ChatMessage.findById(actionData.messageId);
        if (!message) {
          return NextResponse.json({ error: "not_found" }, { status: 404 });
        }

        if (normalizedAction === "delete_message") {
          message.status = "deleted";
          message.deletedAt = new Date();
          message.deletedByUserId = actor._id;
          message.deleteReason = actionData.reason ?? null;
        } else {
          message.status = "visible";
          message.deletedAt = null;
          message.deletedByUserId = null;
          message.deleteReason = null;
        }
        await message.save();

        const targetUser =
          message.authorUserId ? await User.findById(message.authorUserId).lean() : null;

        const action = await createAction({
          targetType: "message",
          targetMessageId: message._id,
          targetUserId: message.authorUserId ?? null,
          actionType: normalizedAction,
          reasonCode: normalizedAction === "delete_message" ? "manual_delete" : "manual_restore",
          reasonText: actionData.reason ?? null,
          targetUserSnapshot: targetUser,
          sourceMessageSnapshot: sourceMessageSnapshot(message),
        });

        if (normalizedAction === "delete_message") {
          await ChatReport.updateMany(
            { messageId: message._id, status: "open" },
            {
              $set: {
                status: "actioned",
                resolvedByUserId: actor._id,
                resolvedAt: new Date(),
                resolutionActionId: action._id,
              },
            }
          );

          await appendChatArchiveEvent({
            roomId: room._id,
            eventType: "message_deleted",
            messageId: message._id,
            submissionSeq: message.submissionSeq,
            actorUserId: actor._id,
            payload: { actionId: action._id.toString(), reason: actionData.reason ?? null },
          });

          await publishRoomEvent(room.slug, {
            type: "message_removed",
            payload: {
              messageId: message._id.toString(),
              status: "deleted",
              reason: actionData.reason ?? null,
            },
          });
        } else {
          const serializedMessage = await serializeChatMessageWithCurrentRelations(message);
          await publishRoomEvent(room.slug, {
            type: "message_created",
            payload: { message: serializedMessage },
          });
        }
        moderationUpdateKind = normalizedAction;
        break;
      }
      case "timeout_user":
      case "ban_user":
      case "shadow_mute_user":
      case "lift_timeout":
      case "lift_ban":
      case "lift_shadow_mute": {
        if (!actionData.targetUserId) {
          return NextResponse.json({ error: "target_user_required" }, { status: 400 });
        }
        const targetUser = await User.findById(actionData.targetUserId).lean();
        if (!targetUser) {
          return NextResponse.json({ error: "not_found" }, { status: 404 });
        }
        if (
          normalizedAction !== "lift_timeout" &&
          normalizedAction !== "lift_ban" &&
          normalizedAction !== "lift_shadow_mute"
        ) {
          if (targetUser._id.toString() === actor._id.toString()) {
            return NextResponse.json(
              { error: "self_restriction_not_allowed" },
              { status: 400 }
            );
          }
          if (isChatStaff(targetUser.role)) {
            return NextResponse.json({ error: "protected_target" }, { status: 400 });
          }
        }

        const [userState, sourceMessage] = await Promise.all([
          ensureChatUserState(targetUser as never),
          actionData.sourceMessageId ? ChatMessage.findById(actionData.sourceMessageId) : null,
        ]);

        const minutes = actionData.durationMinutes ?? 15;
        const timeoutUntil = new Date(Date.now() + minutes * 60 * 1000);

        if (normalizedAction === "timeout_user") {
          userState.chatStatus = "timed_out";
          userState.timeoutUntil = timeoutUntil;
          userState.activeRestriction = {
            type: "timed_out",
            reason: actionData.reason ?? null,
            sourceMessageId: sourceMessage?._id ?? null,
            sourceMessageBody: sourceMessage?.bodyDisplay ?? null,
            sourceVisibleSeq: sourceMessage?.visibleSeq ?? null,
            actorUserId: actor._id,
            actorName: actor.name ?? actor.username ?? "Admin",
            imposedAt: new Date(),
            expiresAt: timeoutUntil,
          };
        } else if (normalizedAction === "ban_user") {
          userState.chatStatus = "banned";
          userState.timeoutUntil = null;
          userState.banReason = actionData.reason ?? null;
          userState.activeRestriction = {
            type: "banned",
            reason: actionData.reason ?? null,
            sourceMessageId: sourceMessage?._id ?? null,
            sourceMessageBody: sourceMessage?.bodyDisplay ?? null,
            sourceVisibleSeq: sourceMessage?.visibleSeq ?? null,
            actorUserId: actor._id,
            actorName: actor.name ?? actor.username ?? "Admin",
            imposedAt: new Date(),
            expiresAt: null,
          };
        } else if (normalizedAction === "shadow_mute_user") {
          userState.chatStatus = "shadow_muted";
          userState.timeoutUntil = null;
          userState.activeRestriction = {
            type: "shadow_muted",
            reason: actionData.reason ?? null,
            sourceMessageId: sourceMessage?._id ?? null,
            sourceMessageBody: sourceMessage?.bodyDisplay ?? null,
            sourceVisibleSeq: sourceMessage?.visibleSeq ?? null,
            actorUserId: actor._id,
            actorName: actor.name ?? actor.username ?? "Admin",
            imposedAt: new Date(),
            expiresAt: null,
          };
        } else {
          userState.chatStatus = "active";
          userState.timeoutUntil = null;
          if (normalizedAction === "lift_ban") {
            userState.banReason = null;
          }
        }

        const sourceSnapshot =
          sourceMessage
            ? sourceMessageSnapshot(sourceMessage)
            : userState.activeRestriction
              ? activeRestrictionSnapshot({
                  sourceMessageId: userState.activeRestriction.sourceMessageId,
                  sourceMessageBody: userState.activeRestriction.sourceMessageBody,
                  sourceVisibleSeq: userState.activeRestriction.sourceVisibleSeq,
                })
              : null;

        let reversalOfActionId: Types.ObjectId | null = null;
        if (
          normalizedAction === "lift_timeout" ||
          normalizedAction === "lift_ban" ||
          normalizedAction === "lift_shadow_mute"
        ) {
          const reversalActionType = findReversalActionType(normalizedAction);
          const previousAction = reversalActionType
            ? await ChatModerationAction.findOne({
                targetUserId: targetUser._id,
                actionType: reversalActionType,
              })
                .sort({ createdAt: -1 })
                .lean()
            : null;
          reversalOfActionId = previousAction?._id ?? null;
          userState.activeRestriction = null;
        }

        await userState.save();

        const action = await createAction({
          targetType: "user",
          targetUserId: targetUser._id,
          actionType: normalizedAction,
          reasonCode: normalizedAction,
          reasonText: actionData.reason ?? null,
          durationSeconds: normalizedAction === "timeout_user" ? minutes * 60 : null,
          expiresAt: normalizedAction === "timeout_user" ? timeoutUntil : null,
          targetUserSnapshot: targetUser,
          sourceMessageSnapshot: sourceSnapshot,
          reversalOfActionId,
        });

        await appendChatArchiveEvent({
          roomId: room._id,
          eventType: "moderation_action",
          actorUserId: actor._id,
          payload: {
            actionId: action._id.toString(),
            targetUserId: targetUser._id.toString(),
            actionType: normalizedAction,
            reason: actionData.reason ?? null,
            sourceMessageId: sourceSnapshot?.messageId?.toString() ?? null,
            sourceMessageBody: sourceSnapshot?.body ?? null,
          },
        });

        await publishUserEvent(targetUser._id.toString(), {
          type: "user_notice",
          payload: {
            kind: normalizedAction,
            reason: actionData.reason ?? null,
            expiresAt: normalizedAction === "timeout_user" ? timeoutUntil.toISOString() : null,
          },
        });
        moderationUpdateKind = "restriction_changed";
        break;
      }
      case "set_room_mode": {
        const mode = actionData.roomMode ?? "open";
        room.mode = mode;
        await room.save();
        const action = await createAction({
          targetType: "room",
          actionType: "set_room_mode",
          reasonCode: "room_mode_updated",
          reasonText: actionData.reason ?? null,
          metadata: { roomMode: mode },
        });
        await appendChatArchiveEvent({
          roomId: room._id,
          eventType: "room_updated",
          actorUserId: actor._id,
          payload: { actionId: action._id.toString(), roomMode: mode },
        });
        await publishRoomState(room);
        break;
      }
      case "set_slow_mode": {
        const slowModeSeconds = actionData.slowModeSeconds ?? 0;
        room.slowModeSeconds = slowModeSeconds;
        room.mode = slowModeSeconds > 0 ? "slow_mode" : "open";
        await room.save();
        const action = await createAction({
          targetType: "room",
          actionType: "set_slow_mode",
          reasonCode: "slow_mode_updated",
          reasonText: actionData.reason ?? null,
          metadata: { slowModeSeconds },
        });
        await appendChatArchiveEvent({
          roomId: room._id,
          eventType: "room_updated",
          actorUserId: actor._id,
          payload: { actionId: action._id.toString(), slowModeSeconds },
        });
        await publishRoomState(room);
        break;
      }
      default:
        return NextResponse.json({ error: "unsupported_action" }, { status: 400 });
    }

    if (moderationUpdateKind) {
      await publishRoomEvent(room.slug, {
        type: "moderation_updated",
        payload: {
          kind: moderationUpdateKind,
          actionId: createdActionId,
        },
      });
    }

    return NextResponse.json({ ok: true, actionId: createdActionId });
  } catch (error) {
    console.error("[admin chat actions POST]", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
