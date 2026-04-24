"use client";

import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushSubscription } from "@/lib/push/use-push-subscription";

const DISMISS_STORAGE_KEY = "packattack:push-prompt-dismissed";

export function PushNotificationSettings() {
  const { state, working, subscribe, unsubscribe } = usePushSubscription();

  const handleSubscribe = async () => {
    // Re-enabling here also un-dismisses the dashboard banner — the user
    // is clearly engaged again, no reason to keep it hidden.
    try {
      localStorage.removeItem(DISMISS_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    await subscribe();
  };

  if (state === "unsupported") {
    return (
      <p className="text-text-muted text-sm">
        Dein Browser unterstützt keine Push-Benachrichtigungen.
      </p>
    );
  }

  if (state === "loading") {
    return <p className="text-text-muted text-sm">Lädt …</p>;
  }

  if (state === "denied") {
    return (
      <div className="flex items-start gap-3">
        <BellOff className="w-5 h-5 text-text-muted shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="text-text-primary font-medium">
            Browser-Benachrichtigungen sind blockiert
          </p>
          <p className="text-text-muted mt-1">
            Du musst die Berechtigung in den Browser-Einstellungen wieder
            erlauben, damit du sie hier aktivieren kannst.
          </p>
        </div>
      </div>
    );
  }

  if (state === "subscribed") {
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-pa-green/10 flex items-center justify-center shrink-0">
            <Bell className="w-5 h-5 text-pa-green" />
          </div>
          <div>
            <p className="text-text-primary font-medium text-sm">Aktiv</p>
            <p className="text-text-muted text-xs mt-0.5">
              Du bekommst News direkt im Browser.
            </p>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          loading={working}
          onClick={unsubscribe}
        >
          Abbestellen
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-pa-green/10 flex items-center justify-center shrink-0">
          <Bell className="w-5 h-5 text-pa-green" />
        </div>
        <div>
          <p className="text-text-primary font-medium text-sm">
            News direkt im Browser
          </p>
          <p className="text-text-muted text-xs mt-0.5">
            Aktivieren, um neue Releases und Events sofort zu sehen.
          </p>
        </div>
      </div>
      <Button onClick={handleSubscribe} loading={working} size="sm">
        Aktivieren
      </Button>
    </div>
  );
}
