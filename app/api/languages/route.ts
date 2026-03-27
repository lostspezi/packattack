import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Language from "@/models/language";

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const languages = await Language.find({ isActive: true })
      .sort({ code: 1 })
      .lean();

    return NextResponse.json({
      languages: languages.map((l) => ({
        code: l.code,
        name: l.name,
        isDefault: l.isDefault,
        isActive: l.isActive,
      })),
    });
  } catch (err) {
    console.error("[languages GET]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
