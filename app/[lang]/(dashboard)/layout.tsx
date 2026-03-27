import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDictionary, getActiveLanguages } from "@/lib/i18n";
import { UserHeader } from "@/components/layout/user-header";

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

  const [commonDict, languages] = await Promise.all([
    getDictionary(lang, "common"),
    getActiveLanguages(),
  ]);

  const userName = session.user.name ?? session.user.email ?? "User";
  const userRole = (session.user as { role?: string }).role ?? "user";
  const userImage = session.user.image ?? null;

  return (
    <div className="flex-1 bg-bg flex flex-col">
      <UserHeader
        lang={lang}
        dict={commonDict}
        languages={languages}
        userName={userName}
        userImage={userImage}
        userRole={userRole}
      />
      <div className="flex-1 flex flex-col">{children}</div>
    </div>
  );
}
