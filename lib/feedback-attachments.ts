import { GridFSBucket, MongoClient, ObjectId } from "mongodb";
import type { Readable } from "stream";

export const FEEDBACK_ATTACHMENT_MAX_FILES = 4;
export const FEEDBACK_ATTACHMENT_MAX_SIZE = 5 * 1024 * 1024;

const FEEDBACK_ATTACHMENT_ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
  "text/plain",
  "application/json",
] as const;

type AllowedFeedbackAttachmentType = (typeof FEEDBACK_ATTACHMENT_ALLOWED_TYPES)[number];

export interface FeedbackAttachmentInput {
  filename: string;
  contentType: AllowedFeedbackAttachmentType;
  buffer: Buffer;
  uploadedByUserId: string;
  feedbackId?: string | null;
  messageId?: string | null;
}

export interface FeedbackStoredAttachment {
  attachmentId: string;
  filename: string;
  contentType: string;
  size: number;
  uploadedAt: Date;
}

let client: MongoClient | null = null;

function getMongoClient(): MongoClient {
  if (!client) {
    client = new MongoClient(process.env.MONGODB_URI!);
  }

  return client;
}

async function getBucket(): Promise<GridFSBucket> {
  const mongoClient = getMongoClient();
  await mongoClient.connect();

  return new GridFSBucket(mongoClient.db(), {
    bucketName: "feedback_attachments",
  });
}

export function isAllowedFeedbackAttachmentType(contentType: string): contentType is AllowedFeedbackAttachmentType {
  return FEEDBACK_ATTACHMENT_ALLOWED_TYPES.includes(contentType as AllowedFeedbackAttachmentType);
}

export function sanitizeFeedbackFilename(filename: string): string {
  const trimmed = filename.trim();
  const cleaned = trimmed.replace(/[^\w.\-() ]+/g, "_").replace(/\s+/g, " ");
  return cleaned.slice(0, 120) || "attachment";
}

export async function uploadFeedbackAttachment(input: FeedbackAttachmentInput): Promise<FeedbackStoredAttachment> {
  const bucket = await getBucket();
  const filename = sanitizeFeedbackFilename(input.filename);
  const fileId = new ObjectId();

  return new Promise<FeedbackStoredAttachment>((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename, {
      id: fileId,
      contentType: input.contentType,
      metadata: {
        uploadedByUserId: input.uploadedByUserId,
        feedbackId: input.feedbackId ?? null,
        messageId: input.messageId ?? null,
      },
    });

    uploadStream.once("error", reject);
    uploadStream.once("finish", () => {
      void (async () => {
        try {
          const [file] = await bucket.find({ _id: fileId }).limit(1).toArray();
          resolve({
            attachmentId: fileId.toString(),
            filename: file?.filename ?? filename,
            contentType: file?.contentType ?? input.contentType,
            size: Number(file?.length ?? input.buffer.length),
            uploadedAt: file?.uploadDate ?? new Date(),
          });
        } catch (error) {
          reject(error);
        }
      })();
    });

    uploadStream.end(input.buffer);
  });
}

export async function getFeedbackAttachment(attachmentId: string): Promise<{
  fileId: ObjectId;
  filename: string;
  contentType: string;
  stream: Readable;
} | null> {
  if (!ObjectId.isValid(attachmentId)) {
    return null;
  }

  const bucket = await getBucket();
  const fileId = new ObjectId(attachmentId);
  const files = await bucket.find({ _id: fileId }).limit(1).toArray();

  if (files.length === 0) {
    return null;
  }

  const file = files[0];
  return {
    fileId,
    filename: file.filename,
    contentType: file.contentType ?? "application/octet-stream",
    stream: bucket.openDownloadStream(fileId) as unknown as Readable,
  };
}

export async function deleteFeedbackAttachments(attachments: Array<{ attachmentId: string }>): Promise<void> {
  if (attachments.length === 0) return;

  const bucket = await getBucket();

  for (const attachment of attachments) {
    if (!ObjectId.isValid(attachment.attachmentId)) continue;

    try {
      await bucket.delete(new ObjectId(attachment.attachmentId));
    } catch {
      // Ignore missing files during cleanup.
    }
  }
}