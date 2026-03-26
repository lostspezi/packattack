import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import { ToastProvider } from "@/components/ui/toast";
import { Footer } from "@/components/layout/footer";
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
  description: "PackAttack.gg — your pack opening platform",
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

  return (
    <html
      lang={lang}
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body className="bg-bg text-text-primary min-h-screen safe-top safe-bottom flex flex-col">
        <SessionProvider>
          <ToastProvider>
            <div className="flex-1">{children}</div>
            <Footer lang={lang} />
          </ToastProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
