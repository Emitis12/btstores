const CACHE_NAME = "btstores-pwa-v1";

const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
];

/*
|--------------------------------------------------------------------------
| INSTALL
|--------------------------------------------------------------------------
*/

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(function (cache) {
        return cache.addAll(APP_SHELL);
      })
      .catch(function (error) {
        console.error(
          "BTStores service worker install error:",
          error
        );
      })
  );

  self.skipWaiting();
});

/*
|--------------------------------------------------------------------------
| ACTIVATE
|--------------------------------------------------------------------------
*/

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (cacheNames) {
        return Promise.all(
          cacheNames
            .filter(function (cacheName) {
              return (
                cacheName.startsWith("btstores-pwa-") &&
                cacheName !== CACHE_NAME
              );
            })
            .map(function (cacheName) {
              return caches.delete(cacheName);
            })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

/*
|--------------------------------------------------------------------------
| FETCH
|--------------------------------------------------------------------------
|
| We deliberately keep the caching strategy conservative.
| BTStores is an authenticated application, so we should NOT
| blindly cache API/Supabase/admin responses.
|
*/

self.addEventListener("fetch", function (event) {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  /*
   * Only handle same-origin requests.
   */
  if (url.origin !== self.location.origin) {
    return;
  }

  /*
   * Do not interfere with Next.js internal requests.
   */
  if (
    url.pathname.startsWith("/_next/") ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  /*
   * Navigation requests:
   * Network first, then cached response if available.
   *
   * This allows BTStores to stay current instead of serving
   * stale authenticated pages.
   */
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(function (response) {
          return response;
        })
        .catch(function () {
          return caches.match("/");
        })
    );

    return;
  }

  /*
   * Static PWA assets:
   * Cache first.
   */
  if (
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/icon-192.png" ||
    url.pathname === "/icon-512.png"
  ) {
    event.respondWith(
      caches.match(request).then(function (cachedResponse) {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request).then(function (response) {
          if (response.ok) {
            const responseClone = response.clone();

            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(request, responseClone);
            });
          }

          return response;
        });
      })
    );
  }
});

/*
|--------------------------------------------------------------------------
| PUSH NOTIFICATIONS
|--------------------------------------------------------------------------
*/

self.addEventListener("push", function (event) {
  let data = {
    title: "BTStores",
    message: "You have a new notification.",
    url: "/admin",
    notification_id: null,
    order_id: null,
  };

  if (event.data) {
    try {
      data = {
        ...data,
        ...event.data.json(),
      };
    } catch (error) {
      console.error(
        "Failed to parse BTStores push notification:",
        error
      );
    }
  }

  const title = data.title || "BTStores";

  const options = {
    body:
      data.message ||
      "You have a new notification.",

    icon: "/icon-192.png",

    badge: "/icon-192.png",

    data: {
      url: data.url || "/admin",
      order_id: data.order_id || null,
      notification_id:
        data.notification_id || null,
    },

    tag:
      data.notification_id ||
      "btstores-notification",

    renotify: true,

    vibrate: [200, 100, 200],

    requireInteraction: false,
  };

  event.waitUntil(
    self.registration.showNotification(
      title,
      options
    )
  );
});

/*
|--------------------------------------------------------------------------
| NOTIFICATION CLICK
|--------------------------------------------------------------------------
*/

self.addEventListener(
  "notificationclick",
  function (event) {
    event.notification.close();

    const notificationData =
      event.notification.data || {};

    let url =
      notificationData.url || "/admin";

    /*
     * If the notification belongs to an order,
     * take the staff member directly to that order.
     */
    if (
      notificationData.order_id &&
      url === "/admin"
    ) {
      url =
        "/admin/orders?order=" +
        encodeURIComponent(
          notificationData.order_id
        );
    }

    event.waitUntil(
      clients
        .matchAll({
          type: "window",
          includeUncontrolled: true,
        })
        .then(function (clientList) {
          for (
            const client of clientList
          ) {
            if (
              "focus" in client
            ) {
              client.navigate(url);

              return client.focus();
            }
          }

          if (
            clients.openWindow
          ) {
            return clients.openWindow(
              url
            );
          }
        })
    );
  }
);