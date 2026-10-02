import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import webpush from "npm:web-push@3.6.7";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json",
    },
  });
}

function plainPushText(value: unknown) {
  return String(value ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "• ")
    .replace(/<\/(?:p|div|li|ul|ol|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  console.log("=== SEND-PUSH START ===");

  try {
    const auth = req.headers.get("Authorization") || "";

    if (!auth) {
      return json({ error: "Missing Authorization header" }, 401);
    }

    const url = Deno.env.get("SUPABASE_URL");
    if (!url) {
      return json({ error: "SUPABASE_URL missing" }, 500);
    }

    const publishableKeys = JSON.parse(
      Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}"
    );

    const publishable =
      publishableKeys.default ||
      Deno.env.get("SUPABASE_ANON_KEY");

    if (!publishable) {
      return json({ error: "Supabase publishable key missing" }, 500);
    }

    const userClient = createClient(url, publishable, {
      global: {
        headers: {
          Authorization: auth,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
    } = await userClient.auth.getUser();

    if (!user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const { data: isAdmin, error: adminError } =
      await userClient.rpc("is_sowki_admin_public");

    if (adminError) {
      return json(
        {
          error: "Admin check failed",
          details: adminError.message,
        },
        500
      );
    }

    if (!isAdmin) {
      return json({ error: "Forbidden" }, 403);
    }

    const secretKeys = JSON.parse(
      Deno.env.get("SUPABASE_SECRET_KEYS") || "{}"
    );

    const secret =
      secretKeys.default ||
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!secret) {
      return json({ error: "Service role key missing" }, 500);
    }

    const admin = createClient(url, secret, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const body = await req.json();
    const notification_id = body?.notification_id;

    if (!notification_id) {
      return json({ error: "notification_id missing" }, 400);
    }

    const { data: notification, error: notificationError } =
      await admin
        .from("notifications")
        .select("*")
        .eq("id", notification_id)
        .single();

    if (notificationError) {
      return json(
        {
          error: "Could not load notification",
          details: notificationError.message,
        },
        500
      );
    }

    const { data: subscriptions, error: subscriptionsError } =
      await admin
        .from("push_subscriptions")
        .select("*");

    if (subscriptionsError) {
      return json(
        {
          error: "Could not load push subscriptions",
          details: subscriptionsError.message,
        },
        500
      );
    }

    const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");

    if (!vapidPublic || !vapidPrivate) {
      return json({ error: "VAPID keys missing" }, 500);
    }

    webpush.setVapidDetails(
      "https://www.sowkitarczyn.pl",
      vapidPublic,
      vapidPrivate
    );

    const targetPage = String(notification.target_page || "");

    const clickUrl = new URL("https://www.sowkitarczyn.pl/");
    clickUrl.searchParams.set(
      "sowki_notification",
      String(notification.id)
    );

    if (targetPage) {
      clickUrl.searchParams.set("sowki_target", targetPage);
    }

    const payload = JSON.stringify({
      title: plainPushText(notification.title) || "Sówki",
      body:
        plainPushText(notification.body) ||
        "Nowa wiadomość dla rodziców.",
      url: clickUrl.toString(),
      notification_id: notification.id,
      target_page: targetPage,
      tag: "sowki-" + notification.id,
    });

    let sent = 0;
    let failed = 0;

    for (const subscription of subscriptions || []) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          payload
        );

        sent++;
      } catch (pushError: any) {
        failed++;

        console.error("PUSH SEND ERROR:", {
          message: pushError?.message,
          statusCode: pushError?.statusCode,
          body: pushError?.body,
        });

        if (
          pushError?.statusCode === 404 ||
          pushError?.statusCode === 410
        ) {
          await admin
            .from("push_subscriptions")
            .delete()
            .eq("id", subscription.id);
        }
      }
    }

    console.log("=== SEND-PUSH FINISHED ===", {
      sent,
      failed,
      total: subscriptions?.length ?? 0,
      target_page: targetPage,
      click_url: clickUrl.toString(),
    });

    return json({
      ok: true,
      sent,
      failed,
      total: subscriptions?.length ?? 0,
      target_page: targetPage,
      click_url: clickUrl.toString(),
    });
  } catch (error: any) {
    console.error("=== SEND-PUSH FATAL ERROR ===", error);

    return json(
      {
        error: error?.message || String(error),
      },
      500
    );
  }
});
