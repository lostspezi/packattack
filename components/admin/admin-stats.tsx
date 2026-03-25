import connectDB from "@/lib/db";
import User from "@/models/user";
import PlatformSettings from "@/models/platform-settings";
import { Card } from "@/components/ui/card";

interface RoleCount {
  _id: string;
  count: number;
}

export async function AdminStats() {
  await connectDB();

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [totalUsers, newUsers, roleAgg, settings] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
    User.aggregate<RoleCount>([
      { $group: { _id: "$role", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    PlatformSettings.findOne().lean(),
  ]);

  const tosVersion = settings?.tosVersion ?? "—";
  const privacyVersion = settings?.privacyVersion ?? "—";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total users — topline */}
      <Card variant="topline" className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
          Total users
        </p>
        <p className="text-3xl font-bold text-text-primary">{totalUsers}</p>
      </Card>

      {/* New users (7 days) — soft */}
      <Card variant="soft" className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
          New users (7 days)
        </p>
        <p className="text-3xl font-bold text-text-primary">{newUsers}</p>
        <p className="text-xs text-pa-green mt-1">+{newUsers} this week</p>
      </Card>

      {/* Users by role — accent */}
      <Card variant="accent" className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
          Users by role
        </p>
        <ul className="space-y-1">
          {roleAgg.map((r) => (
            <li key={r._id} className="flex justify-between text-sm">
              <span className="text-text-secondary">{r._id}</span>
              <span className="font-medium text-text-primary">{r.count}</span>
            </li>
          ))}
          {roleAgg.length === 0 && (
            <li className="text-sm text-text-muted">No data</li>
          )}
        </ul>
      </Card>

      {/* Current versions — soft */}
      <Card variant="soft" className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
          Current versions
        </p>
        <ul className="space-y-1">
          <li className="flex justify-between text-sm">
            <span className="text-text-secondary">TOS</span>
            <span className="font-medium text-text-primary">v{tosVersion}</span>
          </li>
          <li className="flex justify-between text-sm">
            <span className="text-text-secondary">Privacy</span>
            <span className="font-medium text-text-primary">v{privacyVersion}</span>
          </li>
        </ul>
      </Card>
    </div>
  );
}
