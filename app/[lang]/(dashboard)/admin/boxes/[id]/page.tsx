import { notFound } from "next/navigation";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { BoxDetailClient } from "@/components/admin/box-detail-client";
import connectDB from "@/lib/db";
import Box from "@/models/box";

interface BoxData {
  _id: string;
  name: { de: string; en: string };
  description: { de: string; en: string } | null;
  game: string;
  status: "draft" | "published" | "archived";
  priceInCoins: number;
  cardsPerPack: number;
  totalPacks: number | null;
  rarityWeights: Array<{ rarity: string; weight: number }>;
  packsOpened: number;
  cardsCount: number;
  createdAt: string;
}

async function getBox(id: string): Promise<BoxData | null> {
  try {
    await connectDB();
    const box = await Box.findById(id).lean();
    if (!box) return null;
    return {
      _id: box._id.toString(),
      name: box.name,
      description: box.description ?? null,
      game: box.game,
      status: box.status as "draft" | "published" | "archived",
      priceInCoins: box.priceInCoins,
      cardsPerPack: box.cardsPerPack,
      totalPacks: box.totalPacks ?? null,
      rarityWeights: box.rarityWeights ?? [],
      packsOpened: box.packsOpened ?? 0,
      cardsCount: Array.isArray(box.cards) ? box.cards.length : 0,
      createdAt: box.createdAt ? new Date(box.createdAt as Date).toISOString() : "",
    };
  } catch {
    return null;
  }
}

export default async function AdminBoxDetailPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;

  const [adminDict, box] = await Promise.all([
    getDictionary(lang as Locale, "admin"),
    getBox(id),
  ]);

  if (!box) {
    notFound();
  }

  return (
    <BoxDetailClient
      lang={lang}
      dict={adminDict}
      initialBox={box}
    />
  );
}
