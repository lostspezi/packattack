import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import EmailTemplate from "@/models/email-template";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { slug } = await params;

  try {
    await connectDB();

    const template = await EmailTemplate.findOne({ slug }).lean();

    if (!template) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      slug: template.slug,
      name: template.name,
      subject: template.subject,
      body: template.body,
      variables: template.variables,
      updatedAt: template.updatedAt ?? null,
    });
  } catch (err) {
    console.error("[admin/email-templates/[slug] GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { slug } = await params;

  let body: {
    name?: string;
    subject?: { de?: string; en?: string };
    body?: { de?: string; en?: string };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  try {
    await connectDB();

    const update: Record<string, unknown> = {};
    if (body.name !== undefined) update.name = body.name;
    if (body.subject?.de !== undefined) update["subject.de"] = body.subject.de;
    if (body.subject?.en !== undefined) update["subject.en"] = body.subject.en;
    if (body.body?.de !== undefined) update["body.de"] = body.body.de;
    if (body.body?.en !== undefined) update["body.en"] = body.body.en;
    if (userId) update.updatedBy = userId;

    const template = await EmailTemplate.findOneAndUpdate(
      { slug },
      { $set: update },
      { new: true }
    ).lean();

    if (!template) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      slug: template.slug,
      name: template.name,
      subject: template.subject,
      body: template.body,
      variables: template.variables,
      updatedAt: template.updatedAt ?? null,
    });
  } catch (err) {
    console.error("[admin/email-templates/[slug] PATCH]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
