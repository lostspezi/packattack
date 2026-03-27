const LINKS = [
  { key: "link_terms", href: "https://packattack.gg/nutzungsbedingungen/", fallback: "Nutzungsbedingungen" },
  { key: "link_tos", href: "https://packattack.gg/agb/", fallback: "AGB" },
  { key: "link_privacy", href: "https://packattack.gg/datenschutz/", fallback: "Datenschutz" },
  { key: "link_imprint", href: "https://packattack.gg/impressum/", fallback: "Impressum" },
];

export function Footer({ lang, dict }: { lang: string; dict: Record<string, string> }) {
  const year = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-border py-4 px-4 mt-auto">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-text-muted">
        <span>&copy; {year} PackAttack.gg</span>
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          {LINKS.map((link) => (
            <a
              key={link.key}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-text-secondary transition-colors"
            >
              {dict[link.key] ?? link.fallback}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
