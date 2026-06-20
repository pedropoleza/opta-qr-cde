"use client";

import { useEffect } from "react";

// Registra o service worker (#9) para o Checker funcionar offline (PWA).
export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
