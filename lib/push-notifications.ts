import { supabase } from "@/lib/supabase/client";

export async function enablePushNotifications() {
  try {
    // ---------------------------------------------------------
    // 1. Check browser support
    // ---------------------------------------------------------

    if (typeof window === "undefined") {
      return {
        success: false,
        message: "Push notifications are only available in a browser.",
      };
    }

    if (!("Notification" in window)) {
      return {
        success: false,
        message: "This browser does not support notifications.",
      };
    }

    if (!("serviceWorker" in navigator)) {
      return {
        success: false,
        message: "This browser does not support service workers.",
      };
    }

    if (!("PushManager" in window)) {
      return {
        success: false,
        message: "This browser does not support push notifications.",
      };
    }

    // ---------------------------------------------------------
    // 2. Get currently authenticated user
    // ---------------------------------------------------------

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        success: false,
        message: "You must be logged in to enable notifications.",
      };
    }

    // ---------------------------------------------------------
    // 3. Check notification permission
    // ---------------------------------------------------------

    let permission = Notification.permission;

    if (permission === "default") {
      permission = await Notification.requestPermission();
    }

    if (permission !== "granted") {
      return {
        success: false,
        message:
          "Notification permission was not granted. Please allow notifications in your browser settings.",
      };
    }

    // ---------------------------------------------------------
    // 4. Register service worker
    // ---------------------------------------------------------

    const registration = await navigator.serviceWorker.register("/sw.js");

    await navigator.serviceWorker.ready;

    // ---------------------------------------------------------
    // 5. Get VAPID public key
    //
    // IMPORTANT:
    // Replace this value with your VAPID PUBLIC key.
    //
    // NEVER put your VAPID PRIVATE key here.
    // ---------------------------------------------------------

    const vapidPublicKey =
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

    if (!vapidPublicKey) {
      console.error(
        "NEXT_PUBLIC_VAPID_PUBLIC_KEY is missing."
      );

      return {
        success: false,
        message: "Push notification configuration is incomplete.",
      };
    }

    // ---------------------------------------------------------
    // 6. Check whether this browser already has a subscription
    // ---------------------------------------------------------

    let subscription =
      await registration.pushManager.getSubscription();

    // ---------------------------------------------------------
    // 7. Create subscription if one doesn't exist
    // ---------------------------------------------------------

    if (!subscription) {
      subscription =
        await registration.pushManager.subscribe({
          userVisibleOnly: true,

          applicationServerKey:
            urlBase64ToUint8Array(vapidPublicKey),
        });
    }

    // ---------------------------------------------------------
    // 8. Convert PushSubscription into JSON
    // ---------------------------------------------------------

    const subscriptionJson = subscription.toJSON();

    const endpoint = subscriptionJson.endpoint;

    const p256dh =
      subscriptionJson.keys?.p256dh;

    const auth =
      subscriptionJson.keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      return {
        success: false,
        message: "Could not create a valid push subscription.",
      };
    }

    // ---------------------------------------------------------
    // 9. Save device subscription to Supabase
    // ---------------------------------------------------------

    const { error: saveError } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          user_id: user.id,
          endpoint,
          p256dh,
          auth,
          user_agent: navigator.userAgent,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,endpoint",
        }
      );

    if (saveError) {
      console.error(
        "Failed to save push subscription:",
        saveError
      );

      return {
        success: false,
        message:
          "Notifications were enabled, but the device could not be registered.",
      };
    }

    return {
      success: true,
      message: "Device notifications enabled successfully.",
    };
  } catch (error) {
    console.error(
      "Failed to enable push notifications:",
      error
    );

    return {
      success: false,
      message:
        "Something went wrong while enabling notifications.",
    };
  }
}


// -------------------------------------------------------------
// Disable push notifications for the current device
// -------------------------------------------------------------

export async function disablePushNotifications() {
  try {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator)
    ) {
      return {
        success: false,
        message: "Push notifications are not supported.",
      };
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        success: false,
        message: "You must be logged in.",
      };
    }

    const registration =
      await navigator.serviceWorker.getRegistration("/sw.js");

    if (!registration) {
      return {
        success: true,
        message: "Device notifications are already disabled.",
      };
    }

    const subscription =
      await registration.pushManager.getSubscription();

    if (!subscription) {
      return {
        success: true,
        message: "Device notifications are already disabled.",
      };
    }

    const endpoint = subscription.endpoint;

    // Remove subscription from browser
    await subscription.unsubscribe();

    // Remove subscription from Supabase
    const { error } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", user.id)
      .eq("endpoint", endpoint);

    if (error) {
      console.error(
        "Failed to remove push subscription:",
        error
      );

      return {
        success: false,
        message:
          "Device notification subscription could not be removed from the server.",
      };
    }

    return {
      success: true,
      message: "Device notifications disabled.",
    };
  } catch (error) {
    console.error(
      "Failed to disable push notifications:",
      error
    );

    return {
      success: false,
      message:
        "Something went wrong while disabling notifications.",
    };
  }
}


// -------------------------------------------------------------
// Check whether this browser/device is subscribed
// -------------------------------------------------------------

export async function isPushNotificationsEnabled() {
  try {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      return false;
    }

    const registration =
      await navigator.serviceWorker.getRegistration("/sw.js");

    if (!registration) {
      return false;
    }

    const subscription =
      await registration.pushManager.getSubscription();

    return !!subscription;
  } catch (error) {
    console.error(
      "Failed to check push notification status:",
      error
    );

    return false;
  }
}


// -------------------------------------------------------------
// Convert VAPID public key from Base64 URL format
// into Uint8Array required by PushManager.
// -------------------------------------------------------------

function urlBase64ToUint8Array(
  base64String: string
): ArrayBuffer {
  const padding =
    "=".repeat(
      (4 - (base64String.length % 4)) % 4
    );

  const base64 =
    (base64String + padding)
      .replace(/-/g, "+")
      .replace(/_/g, "/");

  const rawData = window.atob(base64);

  const output = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i);
  }

  return output.buffer;
}