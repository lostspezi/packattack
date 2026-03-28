import { AdminFeedbackInbox } from "@/components/admin/admin-feedback-inbox";
import { getDictionary } from "@/lib/i18n";
import { getFeedbackUiCopy } from "@/lib/feedback-i18n";

export default async function AdminFeedbackPage({
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
        <h2 className="text-2xl font-bold text-text-primary">{copy.inbox.pageTitle}</h2>
        <p className="mt-1 text-sm text-text-secondary">{copy.inbox.pageSubtitle}</p>
      </div>

      <AdminFeedbackInbox lang={lang} dict={feedbackDict} />
    </div>
  );
}
