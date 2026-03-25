import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { Sidebar } from "@/components/layout/sidebar";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

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
    <div className="flex min-h-[calc(100vh-64px)]">
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
      <main className="flex-1 p-4 md:p-6 min-w-0">
        {children}
      </main>
    </div>
  );
}
