"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { usePushSubscription } from "@/lib/push/use-push-subscription";

const DISMISS_STORAGE_KEY = "packattack:push-prompt-dismissed";

export function PushSubscriptionPrompt() {
  const { state, working, subscribe } = usePushSubscription();
  const [dismissed, setDismissed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // One-shot hydration from localStorage. The rule generally guards against
    // re-render loops, but here the effect runs exactly once on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true);
    try {
      setDismissed(localStorage.getItem(DISMISS_STORAGE_KEY) === "1");
    } catch {
      /* localStorage blocked — show the banner */
    }
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  // Only show the nudge while we are eligible to subscribe AND the user has
  // not asked us to stop nagging. Subscribed / denied / unsupported states
  // belong on the settings page.
  if (!hydrated) return null;
  if (dismissed) return null;
  if (state !== "available") return null;

  return (
    <Card variant="topline" className="p-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-pa-green/10 flex items-center justify-center shrink-0">
          <Bell className="w-5 h-5 text-pa-green" />
        </div>
        <div>
          <p className="text-text-primary font-semibold text-sm">
            News direkt vom Team
          </p>
          <p className="text-text-secondary text-xs mt-0.5">
            Erlaube Browser-Benachrichtigungen, um neue Releases und Events sofort
            zu sehen. Kannst du jederzeit in den Einstellungen ändern.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button onClick={subscribe} loading={working} size="sm">
          Aktivieren
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={dismiss}
          aria-label="Banner ausblenden"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  );
}
