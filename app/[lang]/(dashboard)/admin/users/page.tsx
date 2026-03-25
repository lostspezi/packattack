import { auth } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { UserTable } from "@/components/admin/user-table";

export default async function AdminUsersPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  const [adminDict] = await Promise.all([
    getDictionary(lang as Locale, "admin"),
  ]);

  const session = await auth();
  const sessionUserId = (session?.user as { id?: string } | undefined)?.id ?? "";
  const sessionUserRole = (session?.user as { role?: string } | undefined)?.role ?? "user";

  const pageTitle = adminDict["users_pageTitle"] ?? "User Management";
  const pageSubtitle = adminDict["users_pageSubtitle"] ?? "View and manage all users.";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">{pageTitle}</h2>
        <p className="text-text-secondary mt-1 text-sm">{pageSubtitle}</p>
      </div>

      <UserTable
        lang={lang}
        dict={adminDict}
        sessionUserId={sessionUserId}
        sessionUserRole={sessionUserRole}
      />
    </div>
  );
}
