const LINKS = [
  { key: "terms", href: "https://packattack.gg/nutzungsbedingungen/", de: "Nutzungsbedingungen", en: "Terms of Use" },
  { key: "tos", href: "https://packattack.gg/agb/", de: "AGB", en: "Terms of Service" },
  { key: "privacy", href: "https://packattack.gg/datenschutz/", de: "Datenschutz", en: "Privacy Policy" },
  { key: "imprint", href: "https://packattack.gg/impressum/", de: "Impressum", en: "Imprint" },
];

export function Footer({ lang = "en" }: { lang?: string }) {
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
              {lang === "de" ? link.de : link.en}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
