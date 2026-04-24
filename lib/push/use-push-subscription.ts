"use client";

import { useCallback, useEffect, useState } from "react";

export type PushState =
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
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

interface UsePushSubscription {
  state: PushState;
  working: boolean;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function usePushSubscription(): UsePushSubscription {
  const [state, setState] = useState<PushState>("loading");
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
      if (typeof window === "undefined") return;
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        if (!cancelled) setState("unsupported");
        return;
      }
      // Don't eagerly register the SW — registration only happens on opt-in
      // (see subscribe()). If a SW is already registered, evaluate normally.
      if (!cancelled) await evaluate();
    })();
    return () => {
      cancelled = true;
    };
  }, [evaluate]);

  const subscribe = useCallback(async () => {
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

      let reg = await navigator.serviceWorker.getRegistration("/sw.js");
      if (!reg) {
        reg = await navigator.serviceWorker.register("/sw.js");
      }
      await navigator.serviceWorker.ready;

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
  }, [evaluate]);

  const unsubscribe = useCallback(async () => {
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
  }, [evaluate]);

  return { state, working, subscribe, unsubscribe, refresh: evaluate };
}
