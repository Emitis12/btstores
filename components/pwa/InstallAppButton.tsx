"use client";

import {
  Download,
  Smartphone,
  X,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";

import {
  canInstallPWA,
  initializePWAInstallPrompt,
  installPWA,
  isPWAInstalled,
} from "@/lib/pwa";

export default function InstallAppButton() {
  const [
    installAvailable,
    setInstallAvailable,
  ] = useState(false);

  const [
    installed,
    setInstalled,
  ] = useState(false);

  const [
    installing,
    setInstalling,
  ] = useState(false);

  const [
    dismissed,
    setDismissed,
  ] = useState(false);

  useEffect(() => {
    setInstalled(isPWAInstalled());

    const cleanup =
      initializePWAInstallPrompt();

    const handleInstallAvailable =
      () => {
        setInstallAvailable(
          canInstallPWA()
        );
      };

    const handleInstalled = () => {
      setInstalled(true);
      setInstallAvailable(false);
    };

    window.addEventListener(
      "btstores-install-available",
      handleInstallAvailable
    );

    window.addEventListener(
      "btstores-app-installed",
      handleInstalled
    );

    /*
     * Give the browser a moment to fire
     * beforeinstallprompt.
     */
    const timer = window.setTimeout(
      () => {
        setInstallAvailable(
          canInstallPWA()
        );
      },
      1000
    );

    return () => {
      cleanup();

      window.removeEventListener(
        "btstores-install-available",
        handleInstallAvailable
      );

      window.removeEventListener(
        "btstores-app-installed",
        handleInstalled
      );

      window.clearTimeout(timer);
    };
  }, []);

  async function handleInstall() {
    setInstalling(true);

    const result =
      await installPWA();

    if (result.success) {
      setInstalled(true);
      setInstallAvailable(false);
    }

    setInstalling(false);
  }

  if (
    installed ||
    dismissed ||
    !installAvailable
  ) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[100] mx-auto max-w-md">
      <div className="rounded-2xl border border-sky-100 bg-white p-4 shadow-2xl shadow-slate-900/10">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
            <Smartphone size={20} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-900">
                  Install BTStores
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Add BTStores to your home screen
                  for a faster app-like experience.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setDismissed(true)
                }
                className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Dismiss"
              >
                <X size={16} />
              </button>
            </div>

            <button
              type="button"
              onClick={handleInstall}
              disabled={installing}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download size={15} />

              {installing
                ? "Installing..."
                : "Install BTStores"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}