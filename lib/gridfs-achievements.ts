import { GridFSBucket, ObjectId } from "mongodb";
import sharp from "sharp";
import type { Readable } from "stream";
import { getMongoClient } from "@/lib/mongo-client";

const BUCKET_NAME = "achievement_icons";
const ICON_SIZE = 256;
const WEBP_QUALITY = 90;

async function getBucket(): Promise<GridFSBucket> {
  const client = getMongoClient();
  await client.connect();
  return new GridFSBucket(client.db(), { bucketName: BUCKET_NAME });
}

/**
 * Normalisiert ein hochgeladenes Bild auf 256x256 WebP. Quadratischer
 * contain-Zuschnitt mit transparentem Rand, damit breite Pokemon-Karten
 * genauso wie quadratische Medallien sauber aussehen.
 */
export async function uploadAchievementIcon(
  buffer: Buffer,
  contentType: string,
): Promise<{ id: ObjectId }> {
  const processed = await sharp(buffer)
    .rotate()
    .resize(ICON_SIZE, ICON_SIZE, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  const bucket = await getBucket();
  const id = await new Promise<ObjectId>((resolve, reject) => {
    const upload = bucket.openUploadStream(`achievement-${Date.now()}.webp`, {
      contentType: "image/webp",
      metadata: { originalContentType: contentType },
    });
    upload.on("error", reject);
    upload.on("finish", () => resolve(upload.id as ObjectId));
    upload.end(processed);
  });

  return { id };
}

export async function getAchievementIcon(
  id: ObjectId,
): Promise<{ stream: Readable; contentType: string } | null> {
  const bucket = await getBucket();
  const files = await bucket.find({ _id: id }).limit(1).toArray();
  if (files.length === 0) return null;

  return {
    stream: bucket.openDownloadStream(id) as unknown as Readable,
    contentType: files[0].contentType ?? "image/webp",
  };
}

export async function deleteAchievementIcon(id: ObjectId): Promise<void> {
  const bucket = await getBucket();
  try {
    await bucket.delete(id);
  } catch (err) {
    const message = (err as Error)?.message ?? "";
    if (message.includes("FileNotFound") || message.includes("not found")) return;
    throw err;
  }
}
