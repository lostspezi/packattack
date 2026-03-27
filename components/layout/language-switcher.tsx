"use client";

import { usePathname, useRouter } from "next/navigation";

interface LanguageSwitcherProps {
  lang: string;
  languages: { code: string; name: string }[];
}

export function LanguageSwitcher({ lang, languages }: LanguageSwitcherProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Only show when 2+ languages are active
  if (languages.length < 2) return null;

  function switchLocale(newLang: string) {
    if (newLang === lang) return;

    // Replace the locale segment in the current pathname
    const segments = pathname.split("/");
    segments[1] = newLang;
    const newPath = segments.join("/");

    router.push(newPath);
  }

  return (
    <div className="flex items-center gap-1 rounded-lg bg-white/4 border border-white/8 p-0.5">
      {languages.map(({ code }) => (
        <button
          key={code}
          onClick={() => switchLocale(code)}
          className={[
            "px-2.5 py-1 rounded-md text-xs font-semibold transition-colors",
            lang === code
              ? "bg-pa-green text-bg"
              : "text-text-muted hover:text-text-primary",
          ].join(" ")}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
