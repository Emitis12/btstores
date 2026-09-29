export type BeforeInstallPromptEvent =
  Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{
      outcome: "accepted" | "dismissed";
      platform: string;
    }>;
  };

let deferredPrompt:
  | BeforeInstallPromptEvent
  | null = null;

export function initializePWAInstallPrompt() {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleBeforeInstallPrompt = (
    event: Event
  ) => {
    event.preventDefault();

    deferredPrompt =
      event as BeforeInstallPromptEvent;

    window.dispatchEvent(
      new CustomEvent(
        "btstores-install-available"
      )
    );
  };

  const handleAppInstalled = () => {
    deferredPrompt = null;

    window.dispatchEvent(
      new CustomEvent(
        "btstores-app-installed"
      )
    );
  };

  window.addEventListener(
    "beforeinstallprompt",
    handleBeforeInstallPrompt
  );

  window.addEventListener(
    "appinstalled",
    handleAppInstalled
  );

  return () => {
    window.removeEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt
    );

    window.removeEventListener(
      "appinstalled",
      handleAppInstalled
    );
  };
}

export function isPWAInstalled() {
  if (
    typeof window === "undefined"
  ) {
    return false;
  }

  return (
    window.matchMedia(
      "(display-mode: standalone)"
    ).matches ||
    (
      window.navigator as Navigator & {
        standalone?: boolean;
      }
    ).standalone === true
  );
}

export async function installPWA() {
  if (!deferredPrompt) {
    return {
      success: false,
      outcome: "unavailable" as const,
    };
  }

  try {
    await deferredPrompt.prompt();

    const result =
      await deferredPrompt.userChoice;

    deferredPrompt = null;

    return {
      success:
        result.outcome === "accepted",
      outcome: result.outcome,
    };
  } catch (error) {
    console.error(
      "PWA installation failed:",
      error
    );

    deferredPrompt = null;

    return {
      success: false,
      outcome: "error" as const,
    };
  }
}

export function canInstallPWA() {
  return deferredPrompt !== null;
}