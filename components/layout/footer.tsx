const LINKS = [
  { key: "link_terms", href: "https://packattack.gg/nutzungsbedingungen/", fallback: "Nutzungsbedingungen" },
  { key: "link_tos", href: "https://packattack.gg/agb/", fallback: "AGB" },
  { key: "link_privacy", href: "https://packattack.gg/datenschutz/", fallback: "Datenschutz" },
  { key: "link_imprint", href: "https://packattack.gg/impressum/", fallback: "Impressum" },
];

export function Footer({ lang, dict }: { lang: string; dict: Record<string, string> }) {
  const year = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-white/8 bg-pa-lila py-4 px-4 shrink-0">
      <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/70">
        <span>&copy; {year} PackAttack.gg</span>
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <a
            href={`/${lang}/provably-fair`}
            className="transition-colors text-pa-green hover:text-pa-green"
          >
            Provably Fair
          </a>
          {LINKS.map((link) => (
            <a
              key={link.key}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-pa-green"
            >
              {dict[link.key] ?? link.fallback}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
