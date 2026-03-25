import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { NotificationSender } from "@/components/admin/notification-sender";
import { NotificationHistory } from "@/components/admin/notification-history";

export default async function AdminNotificationsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  const adminDict = await getDictionary(lang as Locale, "admin");

  const pageTitle = adminDict["notifications_pageTitle"] ?? "Notification Management";
  const pageSubtitle =
    adminDict["notifications_pageSubtitle"] ??
    "Send notifications to users individually, by role, or to all users.";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">{pageTitle}</h2>
        <p className="text-text-secondary mt-1 text-sm">{pageSubtitle}</p>
      </div>

      <NotificationSender />
      <NotificationHistory />
    </div>
  );
}
