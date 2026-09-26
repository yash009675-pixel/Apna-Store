import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resendKey = Deno.env.get("RESEND_API_KEY");
const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "APNA STORE <onboarding@resend.dev>";

const admin = createClient(supabaseUrl, serviceKey);

const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c] || c));

Deno.serve(async (_req) => {
  if (!resendKey) {
    return Response.json({ ok: false, configured: false, sent: 0, reason: "RESEND_API_KEY is not configured" }, { status: 200 });
  }

  const { data: deliveries, error: loadError } = await admin
    .from("notification_deliveries")
    .select("id,notification_id,channel,status,attempted_at")
    .eq("channel", "email")
    .in("status", ["pending", "failed"])
    .order("created_at", { ascending: true })
    .limit(20);

  if (loadError) {
    return Response.json({ ok: false, configured: true, sent: 0, error: loadError.message }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;

  for (const delivery of deliveries || []) {
    const { data: claimed } = await admin
      .from("notification_deliveries")
      .update({ status: "queued", attempted_at: new Date().toISOString(), error_message: null })
      .eq("id", delivery.id)
      .in("status", ["pending", "failed"])
      .select("id")
      .maybeSingle();

    if (!claimed) continue;

    const { data: notification } = await admin
      .from("notifications")
      .select("id,user_id,title,body,link,category,created_at")
      .eq("id", delivery.notification_id)
      .maybeSingle();

    if (!notification) {
      await admin.from("notification_deliveries").update({
        status: "failed",
        error_message: "Notification not found"
      }).eq("id", delivery.id);
      failed++;
      continue;
    }

    const { data: userResult, error: userError } = await admin.auth.admin.getUserById(notification.user_id);
    const to = userResult?.user?.email;

    if (userError || !to) {
      await admin.from("notification_deliveries").update({
        status: "failed",
        error_message: userError?.message || "User email not found"
      }).eq("id", delivery.id);
      failed++;
      continue;
    }

    const safeTitle = escapeHtml(notification.title);
    const safeBody = escapeHtml(notification.body).replace(/\n/g, "<br>");
    const safeLink = notification.link ? escapeHtml(notification.link) : "";
    const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;line-height:1.5;color:#111;background:#f7f5f1;padding:24px">
      <div style="max-width:620px;margin:auto;background:#fff;border:1px solid #e5e1da;padding:28px">
        <div style="font-weight:800;letter-spacing:.08em;margin-bottom:20px">APNA<span style="color:#777">STORE</span></div>
        <h2 style="margin:0 0 12px">${safeTitle}</h2>
        <p style="margin:0 0 20px;color:#444">${safeBody}</p>
        ${safeLink ? `<p><a href="${safeLink}" style="display:inline-block;padding:10px 16px;background:#111;color:#fff;text-decoration:none">View in Apna Store</a></p>` : ""}
        <p style="margin-top:28px;color:#777;font-size:12px">This is an Apna Store notification.</p>
      </div>
    </body></html>`;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendKey}`,
        "Idempotency-Key": `apna-notification/${delivery.id}`
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject: notification.title,
        html
      })
    });

    const payload = await response.json().catch(() => ({}));

    if (response.ok && payload?.id) {
      await admin.from("notification_deliveries").update({
        status: "sent",
        provider_message_id: payload.id,
        sent_at: new Date().toISOString(),
        error_message: null
      }).eq("id", delivery.id);
      sent++;
    } else {
      const message = payload?.message || payload?.error?.message || `Resend returned HTTP ${response.status}`;
      await admin.from("notification_deliveries").update({
        status: "failed",
        error_message: String(message).slice(0, 2000)
      }).eq("id", delivery.id);
      failed++;
    }
  }

  return Response.json({
    ok: failed === 0,
    configured: true,
    checked: deliveries?.length || 0,
    sent,
    failed
  });
});
