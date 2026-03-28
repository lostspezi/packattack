import { Card } from "@/components/ui/card";
import { FeedbackListClient } from "@/components/feedback/feedback-list-client";
import { getDictionary } from "@/lib/i18n";
import { getFeedbackUiCopy } from "@/lib/feedback-i18n";

export default async function FeedbackPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const feedbackDict = await getDictionary(lang, "feedback");
  const copy = getFeedbackUiCopy(lang, feedbackDict);

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">{copy.list.myFeedbackTitle}</h2>
        <p className="mt-1 text-sm text-text-secondary">{copy.list.myFeedbackSubtitle}</p>
      </div>

      <Card variant="soft" className="p-4 md:p-6">
        <FeedbackListClient lang={lang} dict={feedbackDict} />
      </Card>
    </div>
  );
}
