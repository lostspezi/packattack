import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import CoinPurchase from "@/models/coin-purchase";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await connectDB();

  const purchase = await CoinPurchase.findById(id).lean();

  if (!purchase) {
    return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
  }

  // Auth: user can only access own invoices, admins can access any
  const isOwner = purchase.userId?.toString() === userId;
  const isAdmin = role === "admin" || role === "super_admin";
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (purchase.status !== "completed") {
    return NextResponse.json(
      { error: "Invoice not available" },
      { status: 404 }
    );
  }

  // Redirect to Stripe hosted invoice or PDF
  const url = purchase.stripeInvoiceUrl || purchase.stripeReceiptUrl;
  if (!url) {
    return NextResponse.json(
      { error: "Invoice not available" },
      { status: 404 }
    );
  }

  return NextResponse.redirect(url);
}
