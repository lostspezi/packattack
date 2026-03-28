import { AdminFeedbackAnalytics } from "@/components/admin/admin-feedback-analytics";
import { getDictionary } from "@/lib/i18n";

export default async function AdminFeedbackAnalyticsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const feedbackDict = await getDictionary(lang, "feedback");

  return <AdminFeedbackAnalytics lang={lang} dict={feedbackDict} />;
}
