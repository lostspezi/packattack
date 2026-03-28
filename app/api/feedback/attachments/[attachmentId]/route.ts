import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { getFeedbackAttachment } from "@/lib/feedback-attachments";
import { isFeedbackStaff } from "@/lib/feedback";
import FeedbackItem from "@/models/feedback-item";
import FeedbackMessage from "@/models/feedback-message";

function isInlineContentType(contentType: string): boolean {
  return contentType.startsWith("image/") || contentType === "application/pdf";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ attachmentId: string }> }
) {
  const session = await auth();
  const viewerUserId = session?.user?.id;
  const viewerRole = (session?.user as { role?: string } | undefined)?.role ?? null;

  if (!viewerUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { attachmentId } = await params;

  try {
    await connectDB();

    const feedbackItem = await FeedbackItem.findOne({ "attachments.attachmentId": attachmentId })
      .select("submitterUserId")
      .lean();

    const feedbackMessage = !feedbackItem
      ? await FeedbackMessage.findOne({ "attachments.attachmentId": attachmentId })
          .select("feedbackId isInternal")
          .populate("feedbackId", "submitterUserId")
          .lean()
      : null;

    const ownerId = feedbackItem
      ? feedbackItem.submitterUserId.toString()
      : (feedbackMessage?.feedbackId as { submitterUserId?: { toString(): string } } | null)?.submitterUserId?.toString() ?? "";

    if (!ownerId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const isAdmin = isFeedbackStaff(viewerRole);
    if (!isAdmin && ownerId !== viewerUserId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (feedbackMessage?.isInternal && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const attachment = await getFeedbackAttachment(attachmentId);
    if (!attachment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      attachment.stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      attachment.stream.on("end", resolve);
      attachment.stream.on("error", reject);
    });

    const buffer = Buffer.concat(chunks);
    const dispositionType = isInlineContentType(attachment.contentType) ? "inline" : "attachment";

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": attachment.contentType,
        "Content-Length": String(buffer.length),
        "Content-Disposition": `${dispositionType}; filename="${attachment.filename}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    console.error("[feedback/attachments GET]", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
