import { MongoClient, GridFSBucket, ObjectId } from "mongodb";
import type { Readable } from "stream";

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
  const db = client.db();
  return new GridFSBucket(db, { bucketName: "licenses" });
}

export async function uploadLicense(
  userId: string,
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<string> {
  await deleteLicense(userId);

  const bucket = await getBucket();

  return new Promise<string>((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename, {
      metadata: { userId },
      contentType,
    });

    uploadStream.on("error", reject);
    uploadStream.on("finish", () => resolve(uploadStream.id.toString()));

    uploadStream.end(buffer);
  });
}

export async function getLicense(fileId: string): Promise<{
  stream: Readable;
  contentType: string;
  filename: string;
} | null> {
  const bucket = await getBucket();

  let objectId: ObjectId;
  try {
    objectId = new ObjectId(fileId);
  } catch {
    return null;
  }

  const files = await bucket.find({ _id: objectId }).toArray();
  if (files.length === 0) return null;

  const file = files[0];
  const stream = bucket.openDownloadStream(objectId);

  return {
    stream: stream as unknown as Readable,
    contentType: file.contentType ?? "application/pdf",
    filename: file.filename,
  };
}

export async function deleteLicense(userId: string): Promise<void> {
  const bucket = await getBucket();
  const files = await bucket.find({ "metadata.userId": userId }).toArray();
  for (const file of files) {
    await bucket.delete(file._id as ObjectId);
  }
}
