import { randomUUID } from "node:crypto";

export type OrderEmailEvent =
  | "pedido_recebido"
  | "pagamento_confirmado"
  | "lote_criado"
  | "em_producao"
  | "pedido_enviado";

const SUBJECTS: Record<OrderEmailEvent, string> = {
  pedido_recebido: "Recebemos seu pedido GCard-PRÓ",
  pagamento_confirmado: "Pagamento confirmado — pedido GCard-PRÓ",
  lote_criado: "Seu lote está pronto — GCard-PRÓ",
  em_producao: "Seu pedido entrou em produção — GCard-PRÓ",
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

/** Envelope visual com a marca -- usado por todo e-mail transacional. */
function emailShell(input: { title: string; bodyHtml: string }): string {
  return `<!doctype html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#F4F3F0;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1A1A1A;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <div style="text-align:center;padding-bottom:24px;">
      <img src="https://gcardpro.com.br/favicon-512.png" width="40" height="40" alt="GCard-PRÓ" style="border-radius:10px;vertical-align:middle;" />
      <span style="font-size:20px;font-weight:800;vertical-align:middle;margin-left:10px;color:#1A1A1A;">GCard-PRÓ</span>
    </div>
    <div style="background:#FFFFFF;border-radius:20px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
      <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#1A1A1A;">${escapeHtml(input.title)}</h1>
      <div style="font-size:15px;line-height:1.65;color:#333333;">${input.bodyHtml}</div>
    </div>
    <div style="text-align:center;padding-top:24px;">
      <p style="margin:0 0 6px;font-size:13px;color:#8A8A8A;">
        Dúvidas? Chama a gente no Instagram
        <a href="https://instagram.com/gcardpro.oficial" style="color:#1A1A1A;font-weight:600;text-decoration:none;">@gcardpro.oficial</a>
      </p>
      <p style="margin:0;font-size:11px;color:#B0B0B0;">
        E-mail transacional sobre seu pedido. Para comunicações estratégicas, usamos apenas contatos com consentimento LGPD.
      </p>
    </div>
  </div>
</body>
</html>`;
}

function eventTitle(event: OrderEmailEvent) {
  if (event === "pedido_recebido") return "Pedido recebido";
  if (event === "pagamento_confirmado") return "Pagamento confirmado";
  if (event === "lote_criado") return "Seu lote está pronto";
  if (event === "em_producao") return "Pedido em produção";
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
    .select("id, order_number, customer_name, customer_email, tracking_code, total_cents, kind")
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

  let nextSteps = "<p>Você receberá novas atualizações quando houver mudança no pedido.</p>";
  if (event === "pagamento_confirmado" && order.kind === "revenda") {
    nextSteps =
      "<p>Suas placas chegam em branco, sem QR/NFC configurado ainda — isso é normal, faz parte do modelo de revenda.</p>" +
      "<p>Vamos preparar seu lote e te avisamos por aqui assim que estiver pronto, com o código de resgate.</p>";
  } else if (event === "pagamento_confirmado") {
    nextSteps =
      "<p>Sua placa está sendo produzida já configurada com o link de avaliação do seu negócio. Assim que for enviada, você recebe o código de rastreio por aqui.</p>";
  } else if (event === "pedido_recebido") {
    nextSteps =
      "<p>Assim que o pagamento for confirmado, te avisamos por aqui com os próximos passos.</p>";
  } else if (event === "lote_criado") {
    const { data: batch } = await db
      .from("batches")
      .select("code")
      .eq("owner_order_id", orderId)
      .maybeSingle();
    const code = batch?.code ?? "";
    nextSteps =
      "<p>Seu lote de plaquinhas já está pronto pra ativar!</p>" +
      `<p><strong>Código do lote:</strong> <code style="font-size:16px">${escapeHtml(code)}</code></p>` +
      '<p>Entre em <a href="https://gcardpro.com.br/ativar">gcardpro.com.br/ativar</a> e faça duas coisas:</p>' +
      "<ol>" +
      "<li>Entre com este mesmo e-mail da compra — se o lote já estiver vinculado, ele aparece automático; ou</li>" +
      `<li>Cole o código do lote acima no campo de resgate.</li>` +
      "</ol>" +
      "<p>Depois é só configurar o link de avaliação de cada plaquinha que você for entregar.</p>";
  } else if (event === "em_producao") {
    nextSteps = "<p>Seu pedido entrou em produção. Assim que for enviado, você recebe o código de rastreio por aqui.</p>";
  } else if (event === "pedido_enviado" && order.kind === "revenda") {
    const { data: batch } = await db
      .from("batches")
      .select("id, code")
      .eq("owner_order_id", orderId)
      .maybeSingle();
    const { data: plates } = batch
      ? await db
          .from("plates")
          .select("short_code, token")
          .eq("batch_id", batch.id)
          .order("short_code")
      : { data: [] };
    const rows = (plates ?? [])
      .map(
        (p: { short_code: string; token: string }) =>
          `<tr><td style="padding:4px 12px 4px 0;font-weight:700;">${escapeHtml(p.short_code)}</td>` +
          `<td style="padding:4px 0;"><a href="https://gcardpro.com.br/r/${p.token}" style="color:#1A1A1A;">gcardpro.com.br/r/${escapeHtml(p.token)}</a></td></tr>`,
      )
      .join("");
    nextSteps =
      "<p>Suas plaquinhas chegam em branco, sem link de avaliação configurado — é assim mesmo no modelo de revenda.</p>" +
      (batch?.code
        ? `<p><strong>Código do lote:</strong> <code style="font-size:16px">${escapeHtml(batch.code)}</code></p>`
        : "") +
      (rows
        ? "<p>Cada plaquinha física tem um código escrito nela. Guarda essa lista de referência:</p>" +
          `<table style="border-collapse:collapse;font-size:14px;">${rows}</table>`
        : "") +
      '<p style="margin-top:16px;">Pra ativar cada uma: entra em <a href="https://gcardpro.com.br/ativar">gcardpro.com.br/ativar</a>, ' +
      "acha o código da plaquinha na lista e cola o link de avaliação do Google do negócio dela.</p>";
  }

  const html = emailShell({
    title: eventTitle(event),
    bodyHtml:
      `<p>Olá, ${escapeHtml(order.customer_name)}.</p>` +
      `<p>Seu pedido <strong>#${escapeHtml(order.order_number)}</strong> está atualizado.</p>` +
      `<p style="margin:16px 0;padding:12px 16px;background:#F4F3F0;border-radius:12px;font-weight:700;">Total: ${formattedTotal}</p>` +
      tracking +
      nextSteps,
  });

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

/** Avisa o dono da loja quando o pagamento de um pedido não pôde ser gerado
 *  nem depois de retry -- sem isso, ninguém saberia até o cliente reclamar. */
export async function notifyAdminPaymentFailure(order: {
  order_number: number;
  customer_name: string;
  customer_email: string;
}) {
  const to = process.env["ADMIN_NOTIFY_EMAIL"];
  if (!to) return { skipped: true, reason: "ADMIN_NOTIFY_EMAIL ausente" };
  const html = emailShell({
    title: "Link de pagamento falhou",
    bodyHtml:
      `<p>O pedido <strong>#${escapeHtml(order.order_number)}</strong> de ${escapeHtml(order.customer_name)} ` +
      `(${escapeHtml(order.customer_email)}) não conseguiu gerar o link do Mercado Pago, mesmo depois de retry automático.</p>` +
      `<p>Entra no painel e usa o botão <strong>"Gerar e copiar link"</strong> no pedido pra mandar manualmente pro cliente.</p>`,
  });
  try {
    return await sendWithResend({
      to,
      subject: `⚠️ Falha no pagamento — pedido #${order.order_number}`,
      html,
    });
  } catch (error) {
    console.error("Falha ao notificar admin sobre pagamento", error);
    return { sent: false };
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
