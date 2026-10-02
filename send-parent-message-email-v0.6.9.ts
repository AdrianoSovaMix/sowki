import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const MAIL_SECRET = "HpEg3uGavBbD4UQMRoqMTDvz87-S0IheDMVwu5rYmPCiDYLu";
const DEFAULT_FROM = "Sówki <powiadomienia@sowkitarczyn.pl>";

function htmlEscape(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function textValue(value: unknown, max = 2000) {
  return String(value ?? "").trim().slice(0, max);
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("pl-PL", {
      timeZone: "Europe/Warsaw",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  if (req.headers.get("x-sowki-mail-secret") !== MAIL_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
  const serviceKey =
    secretKeys.default ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromAddress = Deno.env.get("MESSAGE_EMAIL_FROM") || DEFAULT_FROM;

  if (!supabaseUrl || !serviceKey) {
    return Response.json({ error: "Supabase service configuration missing" }, { status: 500 });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: any = {};
  try {
    body = await req.json();
  } catch {}

  const messageId = Number(body?.message_id);
  if (!Number.isFinite(messageId) || messageId <= 0) {
    return Response.json({ error: "Invalid message_id" }, { status: 400 });
  }

  const { data: message, error: messageError } = await admin
    .from("parent_messages")
    .select("*")
    .eq("id", messageId)
    .single();

  if (messageError || !message) {
    return Response.json(
      { error: "Message not found", details: messageError?.message },
      { status: 404 }
    );
  }

  if (["sent", "partial"].includes(String(message.email_status || ""))) {
    return Response.json({
      ok: true,
      already_processed: true,
      status: message.email_status,
    });
  }

  const { data: recipients, error: recipientsError } = await admin
    .from("message_recipients")
    .select("id,display_name,role,email")
    .eq("active", true)
    .order("id", { ascending: true });

  if (recipientsError) {
    await admin
      .from("parent_messages")
      .update({
        email_status: "failed",
        email_error: recipientsError.message,
      })
      .eq("id", messageId);

    return Response.json({ error: recipientsError.message }, { status: 500 });
  }

  const activeRecipients = recipients || [];

  if (!activeRecipients.length) {
    await admin
      .from("parent_messages")
      .update({
        email_status: "no_recipients",
        email_recipient_count: 0,
        email_success_count: 0,
        email_error: null,
      })
      .eq("id", messageId);

    return Response.json({ ok: true, status: "no_recipients" });
  }

  if (!resendApiKey) {
    await admin
      .from("parent_messages")
      .update({
        email_status: "failed",
        email_recipient_count: activeRecipients.length,
        email_success_count: 0,
        email_error: "Brak sekretu RESEND_API_KEY.",
      })
      .eq("id", messageId);

    return Response.json({ error: "RESEND_API_KEY missing" }, { status: 500 });
  }

  const parentName = textValue(message.parent_name, 100);
  const childName = textValue(message.child_name, 120);
  const messageText = textValue(message.message, 1500);
  const sentDate = formatDate(message.created_at);

  const subject = `Wiadomość od rodzica – ${childName}`;

  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;margin:0 auto;color:#222222;line-height:1.5">
  <p>Dzień dobry,</p>
  <p>przez formularz w aplikacji Sówki została przesłana nowa wiadomość.</p>
  <p>
    <strong>Dziecko:</strong> ${htmlEscape(childName)}<br>
    <strong>Rodzic:</strong> ${htmlEscape(parentName)}<br>
    <strong>Data:</strong> ${htmlEscape(sentDate)}
  </p>
  <p><strong>Treść wiadomości:</strong></p>
  <div style="white-space:pre-wrap">${htmlEscape(messageText)}</div>
  <p style="margin-top:24px;font-size:12px;color:#666666">
    Wiadomość została wysłana automatycznie z formularza kontaktowego aplikacji Sówki.
  </p>
</div>
  `;

  const text = [
    "Dzień dobry,",
    "",
    "przez formularz w aplikacji Sówki została przesłana nowa wiadomość.",
    "",
    `Dziecko: ${childName}`,
    `Rodzic: ${parentName}`,
    `Data: ${sentDate}`,
    "",
    "Treść wiadomości:",
    "",
    messageText,
    "",
    "Wiadomość została wysłana automatycznie z formularza kontaktowego aplikacji Sówki.",
  ].join("\n");

  let success = 0;
  const errors: string[] = [];

  for (const recipient of activeRecipients) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `sowki-parent-message-${messageId}-recipient-${recipient.id}`,
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [recipient.email],
          subject,
          html,
          text,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result?.message ||
          result?.error ||
          `HTTP ${response.status}`
        );
      }

      success++;
    } catch (error: any) {
      errors.push(
        `${recipient.display_name}: ${error?.message || String(error)}`
      );
    }
  }

  const total = activeRecipients.length;
  const status =
    success === total ? "sent" :
    success > 0 ? "partial" :
    "failed";

  await admin
    .from("parent_messages")
    .update({
      email_status: status,
      email_sent_at: success > 0 ? new Date().toISOString() : null,
      email_recipient_count: total,
      email_success_count: success,
      email_error: errors.length ? errors.join(" | ").slice(0, 2000) : null,
    })
    .eq("id", messageId);

  return Response.json({
    ok: success > 0,
    status,
    recipients: total,
    sent: success,
    failed: total - success,
  });
});
