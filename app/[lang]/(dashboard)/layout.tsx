import { redirect } from "next/navigation";
import { ChatDock } from "@/components/chat/chat-dock";
import { UserHeader } from "@/components/layout/user-header";
import { PendingPullsGuard } from "@/components/packs/pending-pulls-guard";
import { auth } from "@/lib/auth";
import { getActiveLanguages, getDictionary } from "@/lib/i18n";

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

  const [commonDict, chatDict, languages] = await Promise.all([
    getDictionary(lang, "common"),
    getDictionary(lang, "chat"),
    getActiveLanguages(),
  ]);

  const userName = session.user.name ?? session.user.email ?? "User";
  const userRole = (session.user as { role?: string }).role ?? "user";
  const userImage = session.user.image ?? null;

  return (
    <div className="flex flex-1 flex-col bg-bg">
      <UserHeader
        lang={lang}
        dict={commonDict}
        languages={languages}
        userName={userName}
        userImage={userImage}
        userRole={userRole}
      />
      <PendingPullsGuard>
        <div className="flex flex-1 flex-col">{children}</div>
      </PendingPullsGuard>
      <ChatDock
        lang={lang}
        dict={chatDict}
        currentUserId={session.user.id}
        userRole={userRole}
      />
    </div>
  );
}
