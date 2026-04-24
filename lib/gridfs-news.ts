import { GridFSBucket, MongoClient, ObjectId } from "mongodb";
import sharp from "sharp";
import type { Readable } from "stream";

const BUCKET_NAME = "news_images";
const MAX_WIDTH = 1600;
const WEBP_QUALITY = 85;

let _client: MongoClient | null = null;

function getMongoClient(): MongoClient {
  if (!_client) {
    _client = new MongoClient(process.env.MONGODB_URI!);
  }
  return _client;
}

async function getBucket(): Promise<GridFSBucket> {
  const client = getMongoClient();
  await client.connect();
  return new GridFSBucket(client.db(), { bucketName: BUCKET_NAME });
}

export async function uploadNewsImage(
  buffer: Buffer,
  contentType: string
): Promise<{ id: ObjectId; width: number; height: number }> {
  const processed = await sharp(buffer)
    .rotate()
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer({ resolveWithObject: true });

  const { data, info } = processed;
  const bucket = await getBucket();

  const id = await new Promise<ObjectId>((resolve, reject) => {
    const upload = bucket.openUploadStream(`news-${Date.now()}.webp`, {
      contentType: "image/webp",
      metadata: { originalContentType: contentType },
    });
    upload.on("error", reject);
    upload.on("finish", () => resolve(upload.id as ObjectId));
    upload.end(data);
  });

  return { id, width: info.width, height: info.height };
}

export async function getNewsImage(
  id: ObjectId
): Promise<{ stream: Readable; contentType: string } | null> {
  const bucket = await getBucket();
  const files = await bucket.find({ _id: id }).limit(1).toArray();
  if (files.length === 0) return null;

  return {
    stream: bucket.openDownloadStream(id) as unknown as Readable,
    contentType: files[0].contentType ?? "image/webp",
  };
}

export async function deleteNewsImage(id: ObjectId): Promise<void> {
  const bucket = await getBucket();
  try {
    await bucket.delete(id);
  } catch (err) {
    const message = (err as Error)?.message ?? "";
    if (message.includes("FileNotFound") || message.includes("not found")) return;
    throw err;
  }
}
