import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Translation from "@/models/translation";
import { invalidateTranslationCache } from "@/lib/i18n";

export async function GET(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const namespace = searchParams.get("namespace");

  try {
    await connectDB();

    if (!namespace) {
      // Return all distinct namespaces with key counts
      const aggregation = await Translation.aggregate([
        {
          $group: {
            _id: "$namespace",
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      const namespaces = aggregation.map((item) => ({
        namespace: item._id as string,
        count: item.count as number,
      }));

      return NextResponse.json({ namespaces });
    }

    // Return all keys for a namespace
    const docs = await Translation.find({ namespace })
      .sort({ key: 1 })
      .lean();

    const keys = docs.map((doc) => ({
      _id: doc._id.toString(),
      namespace: doc.namespace,
      key: doc.key,
      values: doc.values instanceof Map
        ? Object.fromEntries(doc.values)
        : doc.values,
      updatedAt: doc.updatedAt,
    }));

    return NextResponse.json({ keys });
  } catch (err) {
    console.error("[admin/translations GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { namespace?: string; key?: string; values?: Record<string, string> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { namespace, key, values } = body;

  if (!namespace || !key) {
    return NextResponse.json(
      { error: "namespace and key are required" },
      { status: 400 }
    );
  }

  try {
    await connectDB();

    const update: Record<string, unknown> = {};
    if (values) {
      for (const [lang, val] of Object.entries(values)) {
        if (val !== undefined) {
          update[`values.${lang}`] = val;
        }
      }
    }
    if (userId) update.updatedBy = userId;

    const doc = await Translation.findOneAndUpdate(
      { namespace, key },
      { $set: update },
      { returnDocument: "after", upsert: true }
    ).lean();

    await invalidateTranslationCache(namespace);

    return NextResponse.json({
      _id: doc._id.toString(),
      namespace: doc.namespace,
      key: doc.key,
      values: doc.values instanceof Map
        ? Object.fromEntries(doc.values)
        : doc.values,
      updatedAt: doc.updatedAt,
    });
  } catch (err) {
    console.error("[admin/translations PATCH]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
