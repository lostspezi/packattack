import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { getDictionary, type Locale } from "@/lib/i18n";
import User from "@/models/user";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  const session = await auth();
  const tokenRole = (session?.user as { role?: string } | undefined)?.role;
  let role = tokenRole;

  const sessionUserId = session?.user?.id?.trim();
  const email = session?.user?.email?.trim().toLowerCase();
  try {
    await connectDB();

    let dbUserById: { _id?: { toString(): string }; role?: string } | null = null;
    if (sessionUserId && /^[a-f\d]{24}$/i.test(sessionUserId)) {
      dbUserById = await User.findById(sessionUserId).select("_id role").lean();
    }

    let dbUserByEmail: { _id?: { toString(): string }; role?: string } | null = null;
    if (email) {
      dbUserByEmail = await User.findOne({ email }).select("_id role").lean();
    }

    // If identities differ, trust email identity to avoid stale-session id mismatches.
    if (
      dbUserById?._id &&
      dbUserByEmail?._id &&
      dbUserById._id.toString() !== dbUserByEmail._id.toString()
    ) {
      role = dbUserByEmail.role ?? tokenRole;
    } else {
      role = dbUserById?.role ?? dbUserByEmail?.role ?? tokenRole;
    }
  } catch {
    role = tokenRole;
  }

  if (role !== "admin" && role !== "super_admin") {
    redirect(`/${lang}/dashboard`);
  }

  const [adminDict, dashboardDict] = await Promise.all([
    getDictionary(lang as Locale, "admin"),
    getDictionary(lang as Locale, "dashboard"),
  ]);

  const userName = session!.user!.name ?? session!.user!.email ?? "User";
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <div className="flex flex-1">
      <Sidebar
        lang={lang}
        dict={{}}
        adminDict={adminDict}
        dashboardDict={dashboardDict}
        userRole={role}
        userName={userName}
        userInitial={userInitial}
        mode="admin"
      />
      <main className="flex min-w-0 flex-1 flex-col p-4 md:p-6">{children}</main>
    </div>
  );
}
