import { LanguageSwitcher } from "./language-switcher";
import { NotificationBell } from "./notification-bell";

interface HeaderProps {
  lang: string;
  dict: Record<string, string>;
  pageTitle: string;
}

export function Header({ lang, dict: _dict, pageTitle }: HeaderProps) {
  return (
    <header className="h-16 flex items-center justify-between px-6 border-b border-border bg-bg/80 backdrop-blur-sm flex-shrink-0">
      <h1 className="text-xl font-bold text-text-primary">{pageTitle}</h1>
      <div className="flex items-center gap-3">
        <LanguageSwitcher lang={lang} />
        <NotificationBell />
      </div>
    </header>
  );
}
