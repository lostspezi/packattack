"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/toast";

interface SettingsData {
  language: "de" | "en";
  theme: "dark" | "light";
  notifications: {
    email: boolean;
    browser: boolean;
  };
}

interface SettingsFormProps {
  dict: Record<string, string>;
  lang: string;
  initialSettings: SettingsData;
}

export function SettingsForm({ dict, initialSettings }: SettingsFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [language, setLanguage] = useState<"de" | "en">(initialSettings.language);
  const [theme, setTheme] = useState<"dark" | "light">(initialSettings.theme);
  const [emailNotifications, setEmailNotifications] = useState(
    initialSettings.notifications.email
  );
  const [browserNotifications, setBrowserNotifications] = useState(
    initialSettings.notifications.browser
  );

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
          title: data.error ?? (dict["error_save"] ?? "Failed to save settings"),
        });
        return;
      }

      toast({
        type: "success",
        title: dict["success_saved"] ?? "Settings saved successfully",
      });
    } catch {
      toast({
        type: "error",
        title: dict["error_unexpected"] ?? "An unexpected error occurred",
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
      {/* Language */}
      <div>
        <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-3">
          {dict["section_language"] ?? "Language"}
        </h3>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setLanguage("de")}
            className={[
              "px-5 py-2 rounded-[10px] text-sm font-medium cursor-pointer transition-colors",
              language === "de" ? activeClass : inactiveClass,
            ].join(" ")}
          >
            DE
          </button>
          <button
            type="button"
            onClick={() => setLanguage("en")}
            className={[
              "px-5 py-2 rounded-[10px] text-sm font-medium cursor-pointer transition-colors",
              language === "en" ? activeClass : inactiveClass,
            ].join(" ")}
          >
            EN
          </button>
        </div>
      </div>

      {/* Theme */}
      <div>
        <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-3">
          {dict["section_theme"] ?? "Theme"}
        </h3>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setTheme("dark")}
            className={[
              "px-5 py-2 rounded-[10px] text-sm font-medium cursor-pointer transition-colors",
              theme === "dark" ? activeClass : inactiveClass,
            ].join(" ")}
          >
            {dict["theme_dark"] ?? "Dark"}
          </button>
          <button
            type="button"
            onClick={() => setTheme("light")}
            className={[
              "px-5 py-2 rounded-[10px] text-sm font-medium cursor-pointer transition-colors",
              theme === "light" ? activeClass : inactiveClass,
            ].join(" ")}
          >
            {dict["theme_light"] ?? "Light"}
          </button>
        </div>
      </div>

      {/* Notifications */}
      <div>
        <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-3">
          {dict["section_notifications"] ?? "Notifications"}
        </h3>
        <div className="flex flex-col gap-3">
          <Checkbox
            id="email-notifications"
            label={dict["label_email_notifications"] ?? "Email notifications"}
            checked={emailNotifications}
            onCheckedChange={setEmailNotifications}
          />
          <Checkbox
            id="browser-notifications"
            label={dict["label_browser_notifications"] ?? "Browser notifications"}
            checked={browserNotifications}
            onCheckedChange={setBrowserNotifications}
          />
        </div>
      </div>

      <Button type="submit" variant="primary" size="md" loading={loading}>
        {dict["button_save"] ?? "Save Settings"}
      </Button>
    </form>
  );
}
