import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import InvoiceSettings from "@/models/invoice-settings";
import { invoiceSettingsSchema } from "@/lib/validations";

async function getOrCreateSettings() {
  let settings = await InvoiceSettings.findOne();
  if (!settings) {
    settings = await InvoiceSettings.create({});
  }
  return settings;
}

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectDB();
  const settings = await getOrCreateSettings();
  return NextResponse.json(settings);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = invoiceSettingsSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  await connectDB();
  const settings = await getOrCreateSettings();
  Object.assign(settings, parsed.data, { updatedBy: userId });
  await settings.save();

  return NextResponse.json(settings);
}
