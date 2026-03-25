import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import connectDB from "@/lib/db";
import EmailTemplate from "@/models/email-template";
import { EmailTemplatesManager } from "@/components/admin/email-templates-manager";

export default async function AdminEmailTemplatesPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  const adminDict = await getDictionary(lang as Locale, "admin");

  await connectDB();

  const templates = await EmailTemplate.find({})
    .select("slug name updatedAt")
    .sort({ name: 1 })
    .lean();

  const pageTitle =
    adminDict["emailTemplates_pageTitle"] ?? "Email Template Management";
  const pageSubtitle =
    adminDict["emailTemplates_pageSubtitle"] ??
    "Edit email templates for all system notifications.";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">{pageTitle}</h2>
        <p className="text-text-secondary mt-1 text-sm">{pageSubtitle}</p>
      </div>

      <EmailTemplatesManager
        templates={templates.map((t) => ({
          slug: t.slug,
          name: t.name,
          updatedAt: t.updatedAt ? t.updatedAt.toISOString() : null,
        }))}
      />
    </div>
  );
}
