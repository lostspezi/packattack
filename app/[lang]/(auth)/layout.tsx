import { LanguageSwitcher } from "@/components/layout/language-switcher";

export default async function AuthLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  return (
    <div className="relative flex flex-col items-center min-h-screen px-4 py-8">
      {/* Header: logo left, language switcher right */}
      <div className="w-full max-w-md flex items-center justify-between mb-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/logo.svg"
          alt="PackAttack.gg"
          className="h-6 sm:h-7 w-auto"
        />
        <LanguageSwitcher lang={lang} />
      </div>

      <div className="w-full max-w-md flex-1 flex items-center">
        <div className="w-full">
          {children}
        </div>
      </div>
    </div>
  );
}
