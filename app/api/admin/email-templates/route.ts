import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import EmailTemplate from "@/models/email-template";

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await connectDB();

    const templates = await EmailTemplate.find({})
      .select("slug name updatedAt")
      .sort({ name: 1 })
      .lean();

    return NextResponse.json({
      templates: templates.map((t) => ({
        slug: t.slug,
        name: t.name,
        updatedAt: t.updatedAt ?? null,
      })),
    });
  } catch (err) {
    console.error("[admin/email-templates GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
