import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  const session = await auth();
  if (!session?.user) {
    redirect(`/${lang}/login`);
  }

  const [commonDict, dashboardDict, adminDict] = await Promise.all([
    getDictionary(lang as Locale, "common"),
    getDictionary(lang as Locale, "dashboard"),
    getDictionary(lang as Locale, "admin"),
  ]);

  const userName = session.user.name ?? session.user.email ?? "User";
  const userInitial = userName.charAt(0).toUpperCase();
  const userRole = (session.user as { role?: string }).role ?? "user";

  const pageTitle = dashboardDict["pageTitle"] ?? "Dashboard";

  return (
    <div className="flex min-h-screen">
      <Sidebar
        lang={lang}
        dict={commonDict}
        adminDict={adminDict}
        dashboardDict={dashboardDict}
        userRole={userRole}
        userName={userName}
        userInitial={userInitial}
      />
      <div className="ml-64 flex-1 flex flex-col">
        <Header lang={lang} dict={commonDict} pageTitle={pageTitle} />
        <main className="p-6 flex-1">{children}</main>
      </div>
    </div>
  );
}
