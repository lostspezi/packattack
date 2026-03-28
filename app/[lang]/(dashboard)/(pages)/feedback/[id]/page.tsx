import { FeedbackDetailClient } from "@/components/feedback/feedback-detail-client";
import { getDictionary } from "@/lib/i18n";

export default async function FeedbackDetailPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  const feedbackDict = await getDictionary(lang, "feedback");

  return (
    <div className="space-y-6">
      <FeedbackDetailClient lang={lang} feedbackId={id} dict={feedbackDict} mode="user" />
    </div>
  );
}
