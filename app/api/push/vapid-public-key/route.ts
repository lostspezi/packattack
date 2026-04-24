import { NextResponse } from "next/server";
import { getVapidPublicKey } from "@/lib/push/web-push";

export async function GET() {
  const key = getVapidPublicKey();
  if (!key) {
    return NextResponse.json({ error: "push_disabled" }, { status: 503 });
  }
  return NextResponse.json({ key });
}
