import { Card } from "@/components/ui/card";
import { FeedbackForm } from "@/components/feedback/feedback-form";
import { getDictionary } from "@/lib/i18n";
import { getFeedbackUiCopy } from "@/lib/feedback-i18n";

export default async function NewFeedbackPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const feedbackDict = await getDictionary(lang, "feedback");
  const copy = getFeedbackUiCopy(lang, feedbackDict);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">{copy.form.pageTitle}</h2>
        <p className="mt-1 text-sm text-text-secondary">{copy.form.pageSubtitle}</p>
      </div>

      <Card variant="soft" className="p-4 md:p-6">
        <FeedbackForm lang={lang} dict={feedbackDict} />
      </Card>
    </div>
  );
}
