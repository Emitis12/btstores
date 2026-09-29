import webpush from "npm:web-push";
import { createClient } from "npm:@supabase/supabase-js@2";

interface NotificationRecord {
  id: string;
  user_id: string;
  order_id: string | null;
  title: string;
  message: string;
  type: string | null;
  is_read: boolean;
  created_at: string;
}

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: NotificationRecord;
  old_record: NotificationRecord | null;
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
const vapidSubject = Deno.env.get("VAPID_SUBJECT")!;

webpush.setVapidDetails(
  vapidSubject,
  vapidPublicKey,
  vapidPrivateKey
);

const supabase = createClient(
  supabaseUrl,
  serviceRoleKey
);

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({
          error: "Method not allowed",
        }),
        {
          status: 405,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    const payload =
      (await req.json()) as WebhookPayload;

    if (
      payload.type !== "INSERT" ||
      payload.table !== "notifications"
    ) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Event ignored.",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    const notification = payload.record;

    if (!notification?.user_id) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Notification user_id is missing.",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    const { data: subscriptions, error } =
      await supabase
        .from("push_subscriptions")
        .select(
          "id, endpoint, p256dh, auth"
        )
        .eq("user_id", notification.user_id);

    if (error) {
      console.error(
        "Failed to load push subscriptions:",
        error
      );

      return new Response(
        JSON.stringify({
          success: false,
          error: "Could not load push subscriptions.",
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          sent: 0,
          message:
            "User has no registered devices.",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    const url = notification.order_id
      ? `/admin/orders?order=${notification.order_id}`
      : "/admin";

    const pushPayload = JSON.stringify({
      title:
        notification.title || "BTStores",
      message:
        notification.message ||
        "You have a new notification.",
      url,
      order_id:
        notification.order_id || null,
      notification_id:
        notification.id,
      type:
        notification.type || "general",
    });

    let sent = 0;
    let removed = 0;

    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          pushPayload
        );

        sent++;
      } catch (error: any) {
        console.error(
          "Push notification failed:",
          error
        );

        /*
         * 404/410 usually means the browser
         * subscription is no longer valid.
         *
         * Remove it so future notifications
         * do not keep trying the dead device.
         */
        if (
          error?.statusCode === 404 ||
          error?.statusCode === 410
        ) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("id", subscription.id);

          removed++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent,
        removed,
        total_subscriptions:
          subscriptions.length,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error(
      "Push function error:",
      error
    );

    return new Response(
      JSON.stringify({
        success: false,
        error: "Internal server error.",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
});