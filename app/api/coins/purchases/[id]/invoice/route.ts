import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import CoinPurchase from "@/models/coin-purchase";
import InvoiceSettings from "@/models/invoice-settings";
import { generateInvoicePdf } from "@/lib/invoice-generator";

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

  const purchase = await CoinPurchase.findById(id)
    .populate("userId", "name email username")
    .lean();

  if (!purchase) {
    return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
  }

  // Auth: user can only download own invoices, admins can download any
  const isOwner = purchase.userId._id?.toString() === userId;
  const isAdmin = role === "admin" || role === "super_admin";
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (purchase.status !== "completed" || !purchase.invoiceNumber) {
    return NextResponse.json(
      { error: "Invoice not available" },
      { status: 404 }
    );
  }

  const settings = await InvoiceSettings.findOne().lean();
  if (!settings) {
    return NextResponse.json(
      { error: "Invoice settings not configured" },
      { status: 500 }
    );
  }

  const lang = (session.user as { language?: string }).language === "en" ? "en" : "de";
  const pdfBuffer = await generateInvoicePdf(purchase as any, settings as any, lang);

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Rechnung-${purchase.invoiceNumber}.pdf"`,
    },
  });
}
