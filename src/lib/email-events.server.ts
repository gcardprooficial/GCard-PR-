import { randomUUID } from "node:crypto";

export type OrderEmailEvent = "pedido_recebido" | "pagamento_confirmado" | "pedido_enviado";

const SUBJECTS: Record<OrderEmailEvent, string> = {
  pedido_recebido: "Recebemos seu pedido GCard-PRÓ",
  pagamento_confirmado: "Pagamento confirmado — pedido GCard-PRÓ",
  pedido_enviado: "Seu pedido GCard-PRÓ foi enviado",
};

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function eventTitle(event: OrderEmailEvent) {
  if (event === "pedido_recebido") return "Pedido recebido";
  if (event === "pagamento_confirmado") return "Pagamento confirmado";
  return "Pedido enviado";
}

async function sendWithResend(input: { to: string; subject: string; html: string }) {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) return { sent: false, reason: "RESEND_API_KEY ausente" };
  const from =
    process.env["RESEND_FROM"] ??
    process.env["RESEND_FROM_EMAIL"] ??
    "GCard-PRÓ <noreply@gcardpro.com.br>";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [input.to], subject: input.subject, html: input.html }),
  });
  if (!response.ok) throw new Error(`Resend falhou [${response.status}]: ${await response.text()}`);
  return { sent: true };
}

export async function dispatchOrderEmailEvent(orderId: string, event: OrderEmailEvent) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;
  const { data: order, error: orderError } = await db
    .from("orders")
    .select("id, order_number, customer_name, customer_email, tracking_code, total_cents")
    .eq("id", orderId)
    .maybeSingle();
  if (orderError) throw orderError;
  if (!order?.customer_email) return { skipped: true, reason: "sem e-mail" };

  const { data: existing, error: existingError } = await db
    .from("email_events")
    .select("id, status")
    .eq("order_id", orderId)
    .eq("event_type", event)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return { skipped: true, reason: "idempotente", status: existing.status };

  const { data: inserted, error: insertError } = await db
    .from("email_events")
    .insert({
      order_id: orderId,
      event_type: event,
      recipient: order.customer_email,
      status: "processing",
      idempotency_key: `${orderId}:${event}`,
    })
    .select("id")
    .single();
  if (insertError) {
    // A unique constraint protects against concurrent webhook retries.
    if (insertError.code === "23505") return { skipped: true, reason: "idempotente" };
    throw insertError;
  }

  const formattedTotal = `R$ ${(Number(order.total_cents ?? 0) / 100).toFixed(2).replace(".", ",")}`;
  const tracking = order.tracking_code
    ? `<p><strong>Código de rastreio:</strong> ${escapeHtml(order.tracking_code)}</p>`
    : "";
  const html = `<!doctype html><html lang="pt-BR"><body style="font-family:Arial,sans-serif;color:#171717;line-height:1.6"><h1>${eventTitle(event)}</h1><p>Olá, ${escapeHtml(order.customer_name)}.</p><p>Seu pedido <strong>#${escapeHtml(order.order_number)}</strong> está atualizado.</p><p><strong>Total:</strong> ${formattedTotal}</p>${tracking}<p>Você receberá novas atualizações quando houver mudança no pedido.</p><hr><p style="font-size:12px;color:#666">E-mail transacional sobre seu pedido. Para comunicações estratégicas, usamos apenas contatos com consentimento LGPD.</p></body></html>`;

  try {
    const result = await sendWithResend({
      to: order.customer_email,
      subject: SUBJECTS[event],
      html,
    });
    await db
      .from("email_events")
      .update({
        status: result.sent ? "sent" : "queued",
        provider: result.sent ? "resend" : null,
        sent_at: result.sent ? new Date().toISOString() : null,
      })
      .eq("id", inserted.id);
    return { sent: result.sent, queued: !result.sent };
  } catch (error) {
    await db
      .from("email_events")
      .update({
        status: "failed",
        error_message: error instanceof Error ? error.message : String(error),
      })
      .eq("id", inserted.id);
    console.error("Falha no e-mail transacional", { orderId, event, error });
    return { sent: false, failed: true };
  }
}

export async function upsertCustomerConsent(input: {
  email: string;
  name: string;
  consent: boolean;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;
  const now = new Date().toISOString();
  const email = input.email.toLowerCase();
  const { data: existing } = await db
    .from("marketing_contacts")
    .select("unsubscribe_token, marketing_consent_at, marketing_unsubscribed_at")
    .eq("email", email)
    .maybeSingle();
  const payload = input.consent
    ? { email, full_name: input.name, marketing_consent_at: now, marketing_unsubscribed_at: null }
    : { email, full_name: input.name, ...(existing ? {} : { marketing_consent_at: null }) };
  const { data: contact, error } = await db
    .from("marketing_contacts")
    .upsert(payload, { onConflict: "email" })
    .select("unsubscribe_token")
    .single();
  if (error) throw error;
  return contact?.unsubscribe_token ?? randomUUID();
}

export async function queueStrategicUpdate(input: {
  email: string;
  subject: string;
  html: string;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;
  const { data: contact } = await db
    .from("marketing_contacts")
    .select("id, unsubscribe_token")
    .eq("email", input.email.toLowerCase())
    .not("marketing_consent_at", "is", null)
    .is("marketing_unsubscribed_at", null)
    .maybeSingle();
  if (!contact) return { skipped: true, reason: "sem consentimento" };
  const result = await sendWithResend({
    to: input.email,
    subject: input.subject,
    html: `${input.html}<p style="font-size:12px"><a href="${unsubscribeUrl(contact.unsubscribe_token)}">Descadastrar</a></p>`,
  });
  return { sent: result.sent, queued: !result.sent };
}

export function unsubscribeUrl(token: string) {
  return `${process.env["PUBLIC_APP_URL"] ?? "https://gcardpro.com.br"}/api/unsubscribe?token=${encodeURIComponent(token)}`;
}
