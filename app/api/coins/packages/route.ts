import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import CoinPackage from "@/models/coin-package";

export async function GET() {
  await connectDB();
  const packages = await CoinPackage.find({ isActive: true })
    .select("name slug baseCoins bonusCoins priceEurCents icon highlightLabel sortOrder")
    .sort({ sortOrder: 1 })
    .lean();

  return NextResponse.json(packages);
}
