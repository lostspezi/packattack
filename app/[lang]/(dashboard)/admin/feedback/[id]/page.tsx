import { FeedbackDetailClient } from "@/components/feedback/feedback-detail-client";
import { getDictionary } from "@/lib/i18n";

export default async function AdminFeedbackDetailPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  const feedbackDict = await getDictionary(lang, "feedback");

  return <FeedbackDetailClient lang={lang} feedbackId={id} dict={feedbackDict} mode="staff" />;
}
