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
    <div className="relative flex flex-col items-center justify-center min-h-screen px-4 py-8">
      {/* Language switcher — fixed top right */}
      <div className="fixed top-4 right-4 z-10">
        <LanguageSwitcher lang={lang} />
      </div>

      <div className="w-full max-w-md">
        {/* Logo centered above content */}
        <div className="mb-8 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/logo.svg"
            alt="PackAttack.gg"
            className="h-6 sm:h-7 w-auto"
          />
        </div>
        {children}
      </div>
    </div>
  );
}
