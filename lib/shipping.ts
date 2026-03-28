import connectDB from "@/lib/db";
import ShippingTier from "@/models/shipping-tier";

export interface ShippingCostResult {
  costCents: number;
  costCoins: number;
  tierFound: boolean;
}

export async function calculateShippingCost(
  cardCount: number,
  country: "DE" | "AT" | "CH"
): Promise<ShippingCostResult> {
  await connectDB();

  const tier = await ShippingTier.findOne({
    country,
    minCards: { $lte: cardCount },
    maxCards: { $gte: cardCount },
    isActive: true,
  }).lean();

  if (!tier) {
    return { costCents: 0, costCoins: 0, tierFound: false };
  }

  return {
    costCents: tier.costCents,
    costCoins: tier.costCoins,
    tierFound: true,
  };
}
