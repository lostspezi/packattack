"use client";

import { useEffect, useState } from "react";

/**
 * Returns true while the tab is visible to the user. Used to gate background
 * work (SSE connections, polling) so a hidden tab doesn't keep the connection
 * open or fire fetches the user can't see.
 */
export function useDocumentVisible(): boolean {
  const [visible, setVisible] = useState<boolean>(() => {
    if (typeof document === "undefined") return true;
    return document.visibilityState === "visible";
  });

  useEffect(() => {
    function handle() {
      setVisible(document.visibilityState === "visible");
    }
    document.addEventListener("visibilitychange", handle);
    return () => document.removeEventListener("visibilitychange", handle);
  }, []);

  return visible;
}
