import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import FairnessSeed from "@/models/fairness-seed";
import PackOpenCommitment from "@/models/pack-open-commitment";
import AdminFairnessAccessLog from "@/models/admin-fairness-access-log";
import User from "@/models/user";
import { Card } from "@/components/ui/card";

interface PageProps {
  params: Promise<{ lang: string }>;
}

function isAdminRole(role?: string | null) {
  return role === "admin" || role === "super_admin";
}

export const metadata = { title: "Fairness-Admin — PACKATTACK" };

export default async function AdminFairnessPage({ params }: PageProps) {
  const { lang } = await params;

  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role ?? null;
  if (!session?.user || !isAdminRole(role)) {
    redirect(`/${lang}/dashboard`);
  }

  await connectDB();

  const now = new Date();
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [activeSeeds, revealedSeeds, commits7, commits30, commitTotal, topUsers, recentLogs] =
    await Promise.all([
      FairnessSeed.countDocuments({ status: "active" }),
      FairnessSeed.countDocuments({ status: "revealed" }),
      PackOpenCommitment.countDocuments({ createdAt: { $gte: d7 } }),
      PackOpenCommitment.countDocuments({ createdAt: { $gte: d30 } }),
      PackOpenCommitment.countDocuments({}),
      PackOpenCommitment.aggregate([
        { $match: { createdAt: { $gte: d30 } } },
        {
          $group: {
            _id: "$userId",
            opens: { $sum: 1 },
            draws: { $sum: { $subtract: ["$nonceEnd", "$nonceStart"] } },
          },
        },
        { $sort: { opens: -1 } },
        { $limit: 10 },
        {
          $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" },
        },
        { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            userId: { $toString: "$_id" },
            username: "$user.username",
            email: "$user.email",
            opens: 1,
            draws: 1,
          },
        },
      ]),
      AdminFairnessAccessLog.find({})
        .sort({ createdAt: -1 })
        .limit(25)
        .lean(),
    ]);

  // Resolve admin + target user names for the audit log table
  const logUserIds = Array.from(
    new Set(
      recentLogs.flatMap((l) =>
        [l.adminId?.toString(), l.targetUserId?.toString()].filter(Boolean) as string[],
      ),
    ),
  );
  const logUsers = await User.find({ _id: { $in: logUserIds } })
    .select("_id username email")
    .lean();
  const userById = new Map(logUsers.map((u) => [u._id.toString(), u] as const));

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col gap-4">
      <header>
        <h1 className="text-3xl font-bold mb-1">Fairness — Admin</h1>
        <p className="text-text-secondary">
          Read-only. Seed-Writes sind dem User vorbehalten. Jeder Server-Seed-Zugriff wird geloggt.
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Aktive Seeds" value={activeSeeds} />
        <StatCard label="Rotierte Seeds" value={revealedSeeds} />
        <StatCard label="Commits 7T" value={commits7} />
        <StatCard label="Commits 30T" value={commits30} />
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/${lang}/admin/fairness/verify`}
          className="bg-white/5 border border-white/10 rounded-[10px] px-4 py-2 hover:border-pa-green/40 text-sm"
        >
          Freeform-Verifier
        </Link>
        <span className="text-xs text-text-secondary self-center">
          Commit-Total: <span className="font-mono">{commitTotal}</span>
        </span>
      </div>

      <Card variant="soft" className="p-5">
        <h2 className="text-lg font-bold mb-3">Top User (30 Tage)</h2>
        {topUsers.length === 0 ? (
          <p className="text-sm text-text-secondary">Keine Daten.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-text-secondary">
              <tr>
                <th className="text-left py-2">User</th>
                <th className="text-right py-2">Opens</th>
                <th className="text-right py-2">Draws</th>
                <th className="text-right py-2"></th>
              </tr>
            </thead>
            <tbody>
              {topUsers.map((u) => (
                <tr key={u.userId} className="border-t border-white/5">
                  <td className="py-1.5">
                    {u.username || u.email || u.userId}
                  </td>
                  <td className="py-1.5 text-right font-mono">{u.opens}</td>
                  <td className="py-1.5 text-right font-mono">{u.draws}</td>
                  <td className="py-1.5 text-right">
                    <Link
                      href={`/${lang}/admin/fairness/users/${u.userId}`}
                      className="text-pa-green"
                    >
                      Detail
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card variant="soft" className="p-5">
        <h2 className="text-lg font-bold mb-3">Letzte Audit-Einträge</h2>
        {recentLogs.length === 0 ? (
          <p className="text-sm text-text-secondary">Noch keine Zugriffe.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-text-secondary">
              <tr>
                <th className="text-left py-2">Zeit</th>
                <th className="text-left py-2">Admin</th>
                <th className="text-left py-2">Typ</th>
                <th className="text-left py-2">Target User</th>
                <th className="text-left py-2">Context</th>
              </tr>
            </thead>
            <tbody>
              {recentLogs.map((l) => {
                const admin = userById.get(l.adminId?.toString() ?? "");
                const target = l.targetUserId
                  ? userById.get(l.targetUserId.toString())
                  : null;
                return (
                  <tr key={l._id.toString()} className="border-t border-white/5">
                    <td className="py-1.5 whitespace-nowrap text-xs">
                      {new Date(l.createdAt).toLocaleString()}
                    </td>
                    <td className="py-1.5">{admin?.username || admin?.email || "—"}</td>
                    <td className="py-1.5">{l.accessType}</td>
                    <td className="py-1.5">{target?.username || target?.email || "—"}</td>
                    <td className="py-1.5 text-text-secondary text-xs">{l.context ?? ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card variant="soft" className="p-4">
      <div className="text-xs text-text-secondary uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-bold font-mono mt-1">{value}</div>
    </Card>
  );
}
