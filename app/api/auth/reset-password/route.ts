import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/db";
import User from "@/models/user";
import { resetPasswordSchema } from "@/lib/validations";
import { verifyToken } from "@/lib/tokens";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = resetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { token, password } = parsed.data;

    await connectDB();

    const userId = await verifyToken(token, "pwd_reset");
    if (!userId) {
      return NextResponse.json({ error: "invalid_or_expired_token" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    await User.findByIdAndUpdate(userId, { password: hashedPassword });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[reset-password]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
