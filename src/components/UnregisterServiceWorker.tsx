"use client";

import { useEffect } from "react";

/** Rimuove service worker obsoleti (es. PWA precedente) che intercettano le tile OSM. */
export default function UnregisterServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.getRegistrations().then((regs) => {
      for (const reg of regs) void reg.unregister();
    });
  }, []);

  return null;
}
