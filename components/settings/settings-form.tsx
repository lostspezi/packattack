"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/toast";

interface SettingsData {
  language: string;
  theme: "dark" | "light";
  notifications: {
    email: boolean;
    browser: boolean;
  };
}

interface LanguageOption {
  code: string;
  name: string;
  isActive: boolean;
}

interface SettingsFormProps {
  dict: Record<string, string>;
  lang: string;
  initialSettings: SettingsData;
}

export function SettingsForm({ dict, initialSettings }: SettingsFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [availableLanguages, setAvailableLanguages] = useState<LanguageOption[]>([]);

  const [language, setLanguage] = useState(initialSettings.language);
  const [theme, setTheme] = useState<"dark" | "light">(initialSettings.theme);
  const [emailNotifications, setEmailNotifications] = useState(
    initialSettings.notifications.email
  );
  const [browserNotifications, setBrowserNotifications] = useState(
    initialSettings.notifications.browser
  );

  useEffect(() => {
    fetch("/api/admin/languages")
      .then((res) => res.json())
      .then((data: { languages?: LanguageOption[] }) => {
        const active = (data.languages ?? []).filter((l) => l.isActive);
        setAvailableLanguages(active);
      })
      .catch(() => {
        // Fallback: just show current language
        setAvailableLanguages([{ code: initialSettings.language, name: initialSettings.language.toUpperCase(), isActive: true }]);
      });
  }, [initialSettings.language]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language,
          theme,
          notifications: {
            email: emailNotifications,
            browser: browserNotifications,
          },
        }),
      });

      const data = await res.json() as { error?: string };

      if (!res.ok) {
        toast({
          type: "error",
          title: data.error ?? (dict["error_save"] ?? "Einstellungen konnten nicht gespeichert werden"),
        });
        return;
      }

      toast({
        type: "success",
        title: dict["success_saved"] ?? "Einstellungen erfolgreich gespeichert",
      });
    } catch {
      toast({
        type: "error",
        title: dict["error_unexpected"] ?? "Ein unerwarteter Fehler ist aufgetreten",
      });
    } finally {
      setLoading(false);
    }
  }

  const activeClass =
    "bg-pa-green text-bg font-bold border border-pa-green";
  const inactiveClass =
    "bg-white/4 text-text-primary border border-white/8 hover:border-white/16";

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Language — only show if 2+ languages available */}
      {availableLanguages.length >= 2 && (
        <div>
          <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-3">
            {dict["section_language"] ?? "Sprache"}
          </h3>
          <div className="flex flex-wrap gap-3">
            {availableLanguages.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => setLanguage(l.code)}
                className={[
                  "flex-1 sm:flex-none px-5 py-2 rounded-[10px] text-sm font-medium cursor-pointer transition-colors",
                  language === l.code ? activeClass : inactiveClass,
                ].join(" ")}
              >
                {l.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Theme */}
      <div>
        <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-3">
          {dict["section_theme"] ?? "Design"}
        </h3>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setTheme("dark")}
            className={[
              "flex-1 sm:flex-none px-5 py-2 rounded-[10px] text-sm font-medium cursor-pointer transition-colors",
              theme === "dark" ? activeClass : inactiveClass,
            ].join(" ")}
          >
            {dict["theme_dark"] ?? "Dunkel"}
          </button>
          <button
            type="button"
            onClick={() => setTheme("light")}
            className={[
              "flex-1 sm:flex-none px-5 py-2 rounded-[10px] text-sm font-medium cursor-pointer transition-colors",
              theme === "light" ? activeClass : inactiveClass,
            ].join(" ")}
          >
            {dict["theme_light"] ?? "Hell"}
          </button>
        </div>
      </div>

      {/* Notifications */}
      <div>
        <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-3">
          {dict["section_notifications"] ?? "Benachrichtigungen"}
        </h3>
        <div className="flex flex-col gap-3">
          <Checkbox
            id="email-notifications"
            label={dict["label_email_notifications"] ?? "E-Mail-Benachrichtigungen"}
            checked={emailNotifications}
            onCheckedChange={setEmailNotifications}
          />
          <Checkbox
            id="browser-notifications"
            label={dict["label_browser_notifications"] ?? "Browser-Benachrichtigungen"}
            checked={browserNotifications}
            onCheckedChange={setBrowserNotifications}
          />
        </div>
      </div>

      <div className="flex">
        <Button type="submit" variant="primary" size="md" loading={loading} className="w-full md:w-auto">
          {dict["button_save"] ?? "Einstellungen speichern"}
        </Button>
      </div>
    </form>
  );
}
