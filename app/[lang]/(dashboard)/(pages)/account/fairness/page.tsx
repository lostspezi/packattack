import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import User from "@/models/user";
import FairnessSeed from "@/models/fairness-seed";
import SeedManager from "@/components/fairness/SeedManager";

interface PageProps {
  params: Promise<{ lang: string }>;
}

export const metadata = {
  title: "Fairness & Seeds — PACKATTACK",
};

export default async function FairnessSettingsPage({ params }: PageProps) {
  const { lang } = await params;

  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session?.user || !userId) {
    redirect(`/${lang}/login?callbackUrl=/${lang}/account/fairness`);
  }

  await connectDB();

  const [user, seeds] = await Promise.all([
    User.findById(userId)
      .select("fairnessClientSeed fairnessInitializedAt")
      .lean(),
    FairnessSeed.find({ userId })
      .select("_id status serverSeedHash nonce activatedAt revealedAt")
      .sort({ activatedAt: -1 })
      .lean(),
  ]);

  const active = seeds.find((s) => s.status === "active") ?? null;
  const revealed = seeds.filter((s) => s.status === "revealed");

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold mb-2">Fairness &amp; Seeds</h1>
        <p className="text-text-secondary">
          Deine Seeds steuern jeden Pack-Roll. Client-Seed setzt du selbst, Server-Seed rotierst du wann
          immer du willst.{" "}
          <Link href={`/${lang}/provably-fair`} className="text-pa-green">
            Wie funktioniert das nochmal?
          </Link>
        </p>
      </header>

      <SeedManager
        clientSeed={user?.fairnessClientSeed ?? null}
        initializedAt={
          user?.fairnessInitializedAt instanceof Date
            ? user.fairnessInitializedAt.toISOString()
            : null
        }
        activeSeed={
          active
            ? {
                id: active._id.toString(),
                serverSeedHash: active.serverSeedHash,
                nonce: active.nonce,
                activatedAt:
                  active.activatedAt instanceof Date
                    ? active.activatedAt.toISOString()
                    : String(active.activatedAt),
              }
            : null
        }
        revealedSeeds={revealed.map((s) => ({
          id: s._id.toString(),
          serverSeedHash: s.serverSeedHash,
          nonce: s.nonce,
          activatedAt:
            s.activatedAt instanceof Date ? s.activatedAt.toISOString() : String(s.activatedAt),
          revealedAt: s.revealedAt
            ? s.revealedAt instanceof Date
              ? s.revealedAt.toISOString()
              : String(s.revealedAt)
            : null,
        }))}
      />
    </div>
  );
}
