"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type PromptState =
  | "loading"
  | "unsupported"
  | "denied"
  | "subscribed"
  | "available";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

async function getActiveSubscription(): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export function PushSubscriptionPrompt() {
  const [state, setState] = useState<PromptState>("loading");
  const [working, setWorking] = useState(false);

  const evaluate = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    const sub = await getActiveSubscription();
    setState(sub ? "subscribed" : "available");
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!("serviceWorker" in navigator)) {
        setState("unsupported");
        return;
      }
      try {
        await navigator.serviceWorker.register("/sw.js");
      } catch (err) {
        console.warn("[push] SW register failed:", err);
        if (!cancelled) setState("unsupported");
        return;
      }
      if (!cancelled) await evaluate();
    })();
    return () => {
      cancelled = true;
    };
  }, [evaluate]);

  const subscribe = async () => {
    setWorking(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "available");
        return;
      }

      const keyRes = await fetch("/api/push/vapid-public-key");
      if (!keyRes.ok) throw new Error("vapid_unavailable");
      const { key } = (await keyRes.json()) as { key: string };

      const reg = await navigator.serviceWorker.ready;
      const keyBytes = urlBase64ToUint8Array(key);
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes.buffer.slice(
          keyBytes.byteOffset,
          keyBytes.byteOffset + keyBytes.byteLength
        ) as ArrayBuffer,
      });

      const subJson = sub.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: subJson.keys,
          userAgent: navigator.userAgent,
        }),
      });
      if (!res.ok) throw new Error("subscribe_failed");
      setState("subscribed");
    } catch (err) {
      console.warn("[push] subscribe failed:", err);
      await evaluate();
    } finally {
      setWorking(false);
    }
  };

  const unsubscribe = async () => {
    setWorking(true);
    try {
      const sub = await getActiveSubscription();
      if (!sub) {
        setState("available");
        return;
      }
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(endpoint)}`, {
        method: "DELETE",
      });
      setState("available");
    } catch (err) {
      console.warn("[push] unsubscribe failed:", err);
      await evaluate();
    } finally {
      setWorking(false);
    }
  };

  if (state === "loading" || state === "unsupported") return null;

  if (state === "denied") {
    return (
      <Card variant="soft" className="p-3 text-sm text-text-muted flex items-center gap-2">
        <BellOff className="w-4 h-4 shrink-0" />
        <span>
          Browser-Benachrichtigungen sind blockiert. Du kannst sie in den
          Browser-Einstellungen wieder erlauben.
        </span>
      </Card>
    );
  }

  if (state === "subscribed") {
    return (
      <Card variant="soft" className="p-3 text-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-text-secondary">
          <Bell className="w-4 h-4 text-pa-green" />
          <span>News landen direkt im Browser.</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={unsubscribe}
          loading={working}
        >
          Abbestellen
        </Button>
      </Card>
    );
  }

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
            zu sehen.
          </p>
        </div>
      </div>
      <Button onClick={subscribe} loading={working} size="sm">
        Aktivieren
      </Button>
    </Card>
  );
}
