"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaRegister() {
  const [offline, setOffline] = useState(false);
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration can fail on insecure origins or unsupported browsers.
    });
  }, []);

  useEffect(() => {
    const onOffline = () => setOffline(true);
    const onOnline = () => setOffline(false);
    setOffline(!navigator.onLine);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  useEffect(() => {
    const onInstall = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onInstall);
    window.addEventListener("appinstalled", onInstalled);

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone;
    if (standalone) setInstalled(true);

    return () => {
      window.removeEventListener("beforeinstallprompt", onInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function handleInstall() {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  }

  return (
    <>
      {offline && (
        <div className="fixed left-1/2 top-2 z-[4000] -translate-x-1/2 rounded-full bg-slate-900 px-4 py-1.5 text-xs font-medium text-white shadow-lg">
          Offline – begrenset funksjonalitet
        </div>
      )}
      {installEvent && !installed && (
        <div className="fixed bottom-[max(4.5rem,env(safe-area-inset-bottom,0px)+4rem)] left-1/2 z-[4000] flex w-[min(calc(100vw-2rem),22rem)] -translate-x-1/2 items-center justify-between gap-3 rounded-xl border border-blue-200 bg-white px-4 py-3 shadow-lg">
          <p className="text-sm text-slate-700">Installer Arbeidskart på enheten</p>
          <button
            type="button"
            onClick={handleInstall}
            className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Installer
          </button>
        </div>
      )}
    </>
  );
}
