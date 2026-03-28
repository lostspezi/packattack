import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Geist, Geist_Mono } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import { BuildIndicator } from "@/components/layout/build-indicator";
import { ToastProvider } from "@/components/ui/toast";
import { Footer } from "@/components/layout/footer";
import { getActiveLocales, getDefaultLocale, getDictionary } from "@/lib/i18n";
import "@/app/globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PackAttack.gg",
  description: "PackAttack.gg — deine Pack-Opening-Plattform",
  icons: {
    icon: "/favicon.png",
  },
};

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  // Validate locale — redirect to default if invalid
  const activeLocales = await getActiveLocales();
  if (!activeLocales.includes(lang)) {
    const defaultLocale = await getDefaultLocale();
    redirect(`/${defaultLocale}/dashboard`);
  }

  const footerDict = await getDictionary(lang, "footer");

  return (
    <html
      lang={lang}
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body className="bg-bg text-text-primary h-screen safe-top safe-bottom flex flex-col overflow-hidden">
        <SessionProvider>
          <ToastProvider>
            <div className="flex-1 flex flex-col overflow-y-auto">{children}</div>
            <Footer lang={lang} dict={footerDict} />
            <BuildIndicator />
          </ToastProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
