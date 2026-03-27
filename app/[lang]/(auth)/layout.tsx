import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { getActiveLanguages } from "@/lib/i18n";

export default async function AuthLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const languages = await getActiveLanguages();

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen px-4 py-8">
      {/* Desktop: language switcher fixed top right */}
      <div className="hidden sm:block fixed top-4 right-4 z-10">
        <LanguageSwitcher lang={lang} languages={languages} />
      </div>

      <div className="w-full max-w-md">
        {/* Mobile: logo left, switch right */}
        <div className="flex sm:hidden items-center justify-between mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo.svg" alt="PackAttack.gg" className="h-6 w-auto" />
          <LanguageSwitcher lang={lang} languages={languages} />
        </div>

        {/* Desktop: logo centered */}
        <div className="hidden sm:flex justify-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo.svg" alt="PackAttack.gg" className="h-7 w-auto" />
        </div>

        {children}
      </div>
    </div>
  );
}
