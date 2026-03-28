import { redirect } from "next/navigation";
import { AdminChatConsole } from "@/components/admin/chat/admin-chat-console";
import { auth } from "@/lib/auth";
import { buildChatAdminOverview } from "@/lib/chat";
import { getChatUiCopy } from "@/lib/chat-i18n";
import connectDB from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import User from "@/models/user";

export default async function AdminChatPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const session = await auth();
  const role = session?.user?.role ?? null;

  if (!session?.user?.id || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${lang}/dashboard`);
  }

  const chatDict = await getDictionary(lang, "chat");
  const copy = getChatUiCopy(lang, chatDict);

  await connectDB();
  const user = await User.findById(session.user.id).lean();
  if (!user) {
    redirect(`/${lang}/dashboard`);
  }

  const initialData = await buildChatAdminOverview(user as never);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">{copy.admin.title}</h1>
        <p className="mt-1 text-sm text-text-secondary">{copy.admin.subtitle}</p>
      </div>

      <AdminChatConsole
        lang={lang}
        dict={chatDict}
        initialData={initialData}
        currentUserId={session.user.id}
      />
    </div>
  );
}
