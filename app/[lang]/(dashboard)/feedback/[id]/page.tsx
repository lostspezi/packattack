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
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8">
      <FeedbackDetailClient lang={lang} feedbackId={id} dict={feedbackDict} mode="user" />
    </div>
  );
}
