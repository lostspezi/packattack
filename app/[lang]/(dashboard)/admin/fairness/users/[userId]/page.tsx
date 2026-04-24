import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import User from "@/models/user";
import FairnessSeed from "@/models/fairness-seed";
import PackOpenCommitment from "@/models/pack-open-commitment";
import { Card } from "@/components/ui/card";

function isAdminRole(role?: string | null) {
  return role === "admin" || role === "super_admin";
}

interface PageProps {
  params: Promise<{ lang: string; userId: string }>;
}

const PAGE_SIZE = 50;

export const metadata = { title: "User Fairness — Admin" };

export default async function AdminUserFairnessPage({ params }: PageProps) {
  const { lang, userId } = await params;

  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role ?? null;
  if (!session?.user || !isAdminRole(role)) {
    redirect(`/${lang}/dashboard`);
  }

  if (!Types.ObjectId.isValid(userId)) notFound();

  await connectDB();

  const userObjectId = new Types.ObjectId(userId);
  const [user, seeds, commitments, totalCommits] = await Promise.all([
    User.findById(userObjectId)
      .select("_id username email fairnessClientSeed fairnessInitializedAt")
      .lean(),
    FairnessSeed.find({ userId: userObjectId })
      .select("_id status serverSeedHash nonce activatedAt revealedAt")
      .sort({ activatedAt: -1 })
      .lean(),
    PackOpenCommitment.find({ userId: userObjectId })
      .select("_id packGroupId boxId nonceStart nonceEnd createdAt")
      .sort({ createdAt: -1 })
      .limit(PAGE_SIZE)
      .lean(),
    PackOpenCommitment.countDocuments({ userId: userObjectId }),
  ]);

  if (!user) notFound();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-4">
      <header>
        <h1 className="text-3xl font-bold mb-1">Fairness — {user.username || user.email}</h1>
        <p className="text-text-secondary text-sm font-mono">{user._id.toString()}</p>
      </header>

      <Card variant="soft" className="p-5">
        <h2 className="text-lg font-bold mb-2">Stammdaten</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-text-secondary">Client Seed</dt>
          <dd className="font-mono break-all">{user.fairnessClientSeed ?? "—"}</dd>
          <dt className="text-text-secondary">Initialized</dt>
          <dd>
            {user.fairnessInitializedAt
              ? new Date(user.fairnessInitializedAt).toLocaleString()
              : "—"}
          </dd>
        </dl>
      </Card>

      <Card variant="soft" className="p-5">
        <h2 className="text-lg font-bold mb-2">Seeds</h2>
        {seeds.length === 0 ? (
          <p className="text-sm text-text-secondary">Noch keine Seeds.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-text-secondary">
              <tr>
                <th className="text-left py-2">Status</th>
                <th className="text-left py-2">Hash</th>
                <th className="text-right py-2">Nonce</th>
                <th className="text-left py-2">Aktiv von</th>
                <th className="text-left py-2">Revealed</th>
              </tr>
            </thead>
            <tbody>
              {seeds.map((s) => (
                <tr key={s._id.toString()} className="border-t border-white/5">
                  <td className="py-1.5">{s.status}</td>
                  <td className="py-1.5 font-mono text-xs break-all">{s.serverSeedHash}</td>
                  <td className="py-1.5 text-right font-mono">{s.nonce}</td>
                  <td className="py-1.5">{new Date(s.activatedAt).toLocaleDateString()}</td>
                  <td className="py-1.5">
                    {s.revealedAt ? new Date(s.revealedAt).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card variant="soft" className="p-5">
        <h2 className="text-lg font-bold mb-2">
          Commitments ({commitments.length} von {totalCommits})
        </h2>
        {commitments.length === 0 ? (
          <p className="text-sm text-text-secondary">Keine Commits.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-text-secondary">
              <tr>
                <th className="text-left py-2">Zeit</th>
                <th className="text-left py-2">PackGroup</th>
                <th className="text-right py-2">Nonces</th>
                <th className="text-right py-2"></th>
              </tr>
            </thead>
            <tbody>
              {commitments.map((c) => (
                <tr key={c._id.toString()} className="border-t border-white/5">
                  <td className="py-1.5 text-xs">{new Date(c.createdAt).toLocaleString()}</td>
                  <td className="py-1.5 font-mono text-xs break-all">{c.packGroupId}</td>
                  <td className="py-1.5 text-right font-mono">
                    {c.nonceStart}–{c.nonceEnd - 1}
                  </td>
                  <td className="py-1.5 text-right">
                    <Link
                      href={`/${lang}/admin/fairness/commitments/${c._id.toString()}`}
                      className="text-pa-green"
                    >
                      Öffnen
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
