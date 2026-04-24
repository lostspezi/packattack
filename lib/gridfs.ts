import { GridFSBucket, ObjectId } from "mongodb";
import type { Readable } from "stream";
import { getMongoClient } from "@/lib/mongo-client";

async function getBucket(): Promise<GridFSBucket> {
  const client = getMongoClient();
  await client.connect();
  const db = client.db();
  return new GridFSBucket(db, { bucketName: "avatars" });
}

// ---------------------------------------------------------------------------
// Upload avatar for a user. Deletes any existing avatar first.
// ---------------------------------------------------------------------------
export async function uploadAvatar(
  userId: string,
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<void> {
  // Delete existing avatar first (one-per-user rule)
  await deleteAvatar(userId);

  const bucket = await getBucket();

  await new Promise<void>((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename, {
      metadata: { userId },
      contentType,
    });

    uploadStream.on("error", reject);
    uploadStream.on("finish", resolve);

    uploadStream.end(buffer);
  });
}

// ---------------------------------------------------------------------------
// Stream the avatar for a user. Returns null if none exists.
// ---------------------------------------------------------------------------
export async function getAvatar(userId: string): Promise<{
  stream: Readable;
  contentType: string;
} | null> {
  const bucket = await getBucket();

  const files = await bucket
    .find({ "metadata.userId": userId })
    .sort({ uploadDate: -1 })
    .limit(1)
    .toArray();

  if (files.length === 0) return null;

  const file = files[0];
  const stream = bucket.openDownloadStream(file._id as ObjectId);

  return {
    stream: stream as unknown as Readable,
    contentType: file.contentType ?? "image/png",
  };
}

// ---------------------------------------------------------------------------
// Delete all avatar files for a user.
// ---------------------------------------------------------------------------
export async function deleteAvatar(userId: string): Promise<void> {
  const bucket = await getBucket();

  const files = await bucket
    .find({ "metadata.userId": userId })
    .toArray();

  for (const file of files) {
    await bucket.delete(file._id as ObjectId);
  }
}
