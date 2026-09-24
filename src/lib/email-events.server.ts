import { randomUUID } from "node:crypto";
import { WHATSAPP_CONTACTS, whatsappLink } from "@/lib/contact";
import { COMPANY_ADDRESS, COMPANY_ID_LINE } from "@/lib/company";
import { carrierLabel, trackingUrl } from "@/lib/shipping";

export type OrderEmailEvent =
  | "pedido_recebido"
  | "pagamento_pendente"
  | "pagamento_confirmado"
  | "lote_criado"
  | "em_producao"
  | "pedido_enviado"
  | "pedido_entregue";

const SUBJECTS: Record<OrderEmailEvent, string> = {
  pedido_recebido: "Recebemos seu pedido GCard-PRÓ",
  pagamento_pendente: "Falta só o pagamento do seu pedido GCard-PRÓ",
  pagamento_confirmado: "Pagamento confirmado — pedido GCard-PRÓ",
  lote_criado: "Seu lote está pronto — GCard-PRÓ",
  em_producao: "Seu pedido entrou em produção — GCard-PRÓ",
  pedido_enviado: "Seu pedido GCard-PRÓ foi enviado",
  pedido_entregue: "Seu pedido GCard-PRÓ foi entregue",
};

const TITLES: Record<OrderEmailEvent, string> = {
  pedido_recebido: "Pedido recebido",
  pagamento_pendente: "Falta só o pagamento",
  pagamento_confirmado: "Pagamento confirmado",
  lote_criado: "Seu lote está pronto",
  em_producao: "Pedido em produção",
  pedido_enviado: "Pedido enviado",
  pedido_entregue: "Pedido entregue",
};

function siteUrl() {
  return (process.env["PUBLIC_APP_URL"] ?? "https://www.gcardpro.com.br").replace(/\/$/, "");
}

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
  const whats = WHATSAPP_CONTACTS.map(
    (c) =>
      `<a href="${whatsappLink(c.number)}" style="color:#1A1A1A;font-weight:600;text-decoration:none;">${c.name} ${c.display}</a>`,
  ).join(" &nbsp;·&nbsp; ");
  return `<!doctype html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#F4F3F0;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1A1A1A;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <div style="text-align:center;padding-bottom:24px;">
      <img src="${siteUrl()}/favicon-512.png" width="40" height="40" alt="GCard-PRÓ" style="border-radius:10px;vertical-align:middle;" />
      <span style="font-size:20px;font-weight:800;vertical-align:middle;margin-left:10px;color:#1A1A1A;">GCard-PRÓ</span>
    </div>
    <div style="background:#FFFFFF;border-radius:20px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
      <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#1A1A1A;">${escapeHtml(input.title)}</h1>
      <div style="font-size:15px;line-height:1.65;color:#333333;">${input.bodyHtml}</div>
    </div>
    <div style="text-align:center;padding-top:24px;">
      <p style="margin:0 0 6px;font-size:13px;color:#8A8A8A;">
        Precisa de ajuda? WhatsApp: ${whats}
      </p>
      <p style="margin:0 0 6px;font-size:13px;color:#8A8A8A;">
        Ou no Instagram <a href="https://instagram.com/gcardpro.oficial" style="color:#1A1A1A;font-weight:600;text-decoration:none;">@gcardpro.oficial</a>
      </p>
      <p style="margin:0 0 6px;font-size:11px;color:#8A8A8A;">
        ${COMPANY_ID_LINE} · ${COMPANY_ADDRESS}
      </p>
      <p style="margin:0;font-size:11px;color:#B0B0B0;">
        E-mail transacional sobre seu pedido. Para comunicações estratégicas, usamos apenas contatos com consentimento LGPD.
      </p>
    </div>
  </div>
</body>
</html>`;
}

function ctaButton(url: string, label: string) {
  return `<p style="margin:24px 0;text-align:center;"><a href="${escapeHtml(url)}" style="display:inline-block;background:#F59E0B;color:#1A1A1A;font-weight:800;font-size:15px;padding:14px 28px;border-radius:12px;text-decoration:none;">${escapeHtml(label)}</a></p>`;
}

function box(html: string) {
  return `<div style="margin:16px 0;padding:14px 16px;background:#F4F3F0;border-radius:12px;">${html}</div>`;
}

const money = (cents: number) => `R$ ${(Number(cents ?? 0) / 100).toFixed(2).replace(".", ",")}`;

type OrderRow = {
  id: string;
  order_number: number;
  customer_name: string;
  customer_email: string;
  tracking_code: string | null;
  tracking_carrier: string | null;
  total_cents: number;
  kind: string;
};
type ItemRow = {
  product_name: string;
  quantity: number;
  unit_price_cents: number;
  products?: { is_blank?: boolean; has_qr?: boolean } | null;
};

function orderSummary(order: OrderRow, items: ItemRow[]) {
  const lines = items
    .map(
      (i) =>
        `<tr><td style="padding:2px 12px 2px 0;">${escapeHtml(i.quantity)}× ${escapeHtml(i.product_name)}</td>` +
        `<td style="padding:2px 0;text-align:right;white-space:nowrap;">${money(i.unit_price_cents * i.quantity)}</td></tr>`,
    )
    .join("");
  return box(
    `<p style="margin:0 0 8px;font-weight:700;">Pedido #${escapeHtml(order.order_number)}</p>` +
      (lines ? `<table style="width:100%;border-collapse:collapse;font-size:14px;">${lines}</table>` : "") +
      `<p style="margin:10px 0 0;font-weight:800;">Total: ${money(order.total_cents)} · frete grátis</p>`,
  );
}

/** Passo a passo de ativação -- revenda ativa cada plaquinha no /ativar. */
function activationTutorial() {
  return (
    `<p style="margin:16px 0 6px;font-weight:700;">Como ativar cada plaquinha</p>` +
    `<ol style="margin:0;padding-left:20px;">` +
    `<li>Entre em <a href="${siteUrl()}/ativar" style="color:#1A1A1A;font-weight:600;">gcardpro.com.br/ativar</a> com o mesmo e-mail e senha da compra.</li>` +
    `<li>Ache a plaquinha pelo código escrito nela (ex.: <strong>GCARD-00061</strong>).</li>` +
    `<li>Informe o nome do negócio e cole o link de avaliação do Google dele.</li>` +
    `<li>Pronto: o QR e o NFC já apontam pra essa avaliação. Dá pra trocar o link quando quiser, no mesmo painel.</li>` +
    `</ol>`
  );
}

/** Uso do cartão de PVC (só NFC). Sem código, então sem texto de /ativar. */
function cardUsageTips() {
  return (
    `<p style="margin:16px 0 6px;font-weight:700;">Como usar</p>` +
    `<p style="margin:0;">Seu cliente aproxima o celular do cartão (NFC por aproximação) e a avaliação do Google abre.</p>`
  );
}

/** Como o cliente final usa o cartão/placa depois de pronto. */
function usageTips() {
  return (
    `<p style="margin:16px 0 6px;font-weight:700;">Como usar</p>` +
    `<ul style="margin:0;padding-left:20px;">` +
    `<li><strong>Cartão de bolso (PVC):</strong> o cliente aproxima o celular do cartão (NFC por aproximação) e a avaliação abre.</li>` +
    `<li><strong>Placa de acrílico:</strong> o cliente aponta a câmera pro QR Code (e também pode aproximar o celular, se a placa tiver NFC).</li>` +
    `</ul>` +
    `<p style="margin:12px 0 0;">Precisa trocar o link de avaliação depois? Entre em <a href="${siteUrl()}/ativar" style="color:#1A1A1A;font-weight:600;">gcardpro.com.br/ativar</a> com o e-mail da compra (crie a conta com ele se for a primeira vez) e edite o link da sua placa. O QR é dinâmico: não precisa reimprimir nada.</p>`
  );
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

/** Lista de placas (código + link do QR) do lote do pedido, pra e-mails de revenda. */
async function plateManifest(db: any, orderId: string) {
  const { data: batch } = await db
    .from("batches")
    .select("id, code")
    .eq("owner_order_id", orderId)
    .maybeSingle();
  const { data: plates } = batch
    ? await db.from("plates").select("short_code, token").eq("batch_id", batch.id).order("short_code")
    : { data: [] };
  const rows = (plates ?? [])
    .map(
      (p: { short_code: string; token: string }) =>
        `<tr><td style="padding:4px 12px 4px 0;font-weight:700;">${escapeHtml(p.short_code)}</td>` +
        `<td style="padding:4px 0;"><a href="${siteUrl()}/r/${escapeHtml(p.token)}" style="color:#1A1A1A;">${escapeHtml(siteUrl().replace("https://", ""))}/r/${escapeHtml(p.token)}</a></td></tr>`,
    )
    .join("");
  return {
    code: (batch?.code as string | undefined) ?? "",
    html: rows
      ? `<p style="margin:16px 0 6px;font-weight:700;">Códigos das suas plaquinhas</p><table style="border-collapse:collapse;font-size:14px;">${rows}</table>`
      : "",
  };
}

export async function dispatchOrderEmailEvent(
  orderId: string,
  event: OrderEmailEvent,
  extra?: { paymentUrl?: string },
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;
  const { data: order, error: orderError } = await db
    .from("orders")
    .select(
      "id, order_number, customer_name, customer_email, tracking_code, tracking_carrier, total_cents, kind",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (orderError) throw orderError;
  if (!order?.customer_email) return { skipped: true, reason: "sem e-mail" };

  const { data: existing, error: existingError } = await db
    .from("email_events")
    .select("id, status, created_at")
    .eq("order_id", orderId)
    .eq("event_type", event)
    .maybeSingle();
  if (existingError) throw existingError;
  // "processing" preso há mais de 10min = tentativa anterior travou (crash/timeout) --
  // sem isso, um envio que nunca resolveu bloqueia o reenvio pra sempre, igual "failed".
  const stuck =
    existing?.status === "processing" &&
    Date.now() - new Date(existing.created_at).getTime() > 10 * 60_000;
  if (existing && existing.status !== "failed" && !stuck) {
    return { skipped: true, reason: "idempotente", status: existing.status };
  }
  if (existing) await db.from("email_events").delete().eq("id", existing.id);

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

  try {
    const { data: itemRows } = await db
      .from("order_items")
      .select("product_name, quantity, unit_price_cents, products(is_blank, has_qr)")
      .eq("order_id", orderId);
    const items = (itemRows ?? []) as ItemRow[];
    const isBlank = items.some((i) => i.products?.is_blank);
    // Cartão de PVC: só NFC, sem QR e sem código -- não tem lote nem /ativar.
    const cardOnly =
      items.length > 0 && items.every((i) => i.products?.has_qr === false && !i.products?.is_blank);
    const isRevenda = order.kind === "revenda";
    const first = escapeHtml(String(order.customer_name ?? "").split(" ")[0] || "cliente");

    let body = `<p>Olá, ${first}.</p>`;
    const summary = orderSummary(order as OrderRow, items);
    const tracking = order.tracking_code
      ? box(
          `<strong>Transportadora:</strong> ${escapeHtml(carrierLabel(order.tracking_carrier))}<br/>` +
            `<strong>Código de rastreio:</strong> ${escapeHtml(order.tracking_code)}` +
            (trackingUrl(order.tracking_carrier, order.tracking_code)
              ? ` — <a href="${trackingUrl(order.tracking_carrier, order.tracking_code)}" style="color:#1A1A1A;font-weight:700;">rastrear →</a>`
              : ""),
        )
      : "";

    switch (event) {
      case "pedido_recebido":
        body +=
          `<p>Recebemos o seu pedido. Aqui está o resumo:</p>${summary}` +
          `<p>Assim que o pagamento for confirmado, avisamos por aqui com os próximos passos. ` +
          `Se a tela do Mercado Pago não abriu pra você, é só responder este e-mail ou chamar no WhatsApp que a gente resolve.</p>`;
        break;

      case "pagamento_pendente":
        body +=
          `<p>Seu pedido <strong>#${escapeHtml(order.order_number)}</strong> foi registrado, mas o pagamento ainda não foi concluído.</p>${summary}` +
          (extra?.paymentUrl
            ? ctaButton(extra.paymentUrl, "Finalizar pagamento") +
              `<p style="font-size:13px;color:#6B6B6B;">Não precisa ter conta no Mercado Pago: dá pra pagar com Pix, cartão ou boleto como convidado.</p>`
            : `<p>Se quiser, responda este e-mail ou chame no WhatsApp que enviamos um novo link de pagamento.</p>`);
        break;

      case "pagamento_confirmado":
        body += `<p>Recebemos o pagamento do seu pedido. Obrigado!</p>${summary}`;
        if (isBlank) {
          body +=
            `<p>Seu pedido é de <strong>acrílico puro</strong>, sem impressão, QR Code ou NFC: é o material cortado pra você aplicar a sua própria arte. ` +
            `Vamos separar as cores escolhidas e te avisamos quando entrar em produção e quando for enviado.</p>`;
        } else if (cardOnly && isRevenda) {
          body +=
            `<p>Estamos separando os seus cartões de PVC com NFC. Avisamos quando entrar em produção e quando forem enviados, com o código de rastreio.</p>`;
        } else if (isRevenda) {
          body +=
            `<p>As plaquinhas do kit de revenda chegam <strong>sem link de avaliação configurado</strong> — é o modelo de revenda: você ativa cada uma pro negócio do seu cliente.</p>` +
            `<p>Estamos preparando o seu lote. Assim que estiver pronto, você recebe o código do lote por aqui, com a lista das plaquinhas.</p>` +
            activationTutorial();
        } else {
          body +=
            `<p>Seu cartão/placa vai <strong>já configurado</strong> com o link de avaliação do seu negócio no Google. Avisamos quando entrar em produção e quando for enviado, com o código de rastreio.</p>`;
        }
        break;

      case "lote_criado": {
        const manifest = await plateManifest(db, orderId);
        body +=
          `<p>O lote das suas plaquinhas está pronto pra ativar!</p>` +
          (manifest.code
            ? box(`<strong>Código do lote:</strong> <code style="font-size:16px">${escapeHtml(manifest.code)}</code>`)
            : "") +
          manifest.html +
          `<p style="margin-top:16px;">Se o lote não aparecer sozinho na sua conta, cole o código do lote no campo "Resgatar lote" em <a href="${siteUrl()}/ativar" style="color:#1A1A1A;font-weight:600;">gcardpro.com.br/ativar</a>.</p>` +
          activationTutorial();
        break;
      }

      case "em_producao":
        body +=
          `<p>Seu pedido entrou em <strong>produção</strong>.</p>${summary}` +
          `<p>Assim que for enviado, você recebe o código de rastreio por aqui.</p>`;
        break;

      case "pedido_enviado": {
        body += `<p>Seu pedido foi <strong>enviado</strong>! O frete é por nossa conta.</p>${summary}${tracking}`;
        if (cardOnly) {
          body += cardUsageTips();
        } else if (isRevenda && !isBlank) {
          const manifest = await plateManifest(db, orderId);
          body +=
            `<p>As plaquinhas chegam em branco (sem link configurado). Cada uma tem um código escrito — guarde esta lista de referência:</p>` +
            manifest.html +
            activationTutorial();
        } else if (!isBlank) {
          body += usageTips();
        }
        break;
      }

      case "pedido_entregue":
        body += `<p>O seu pedido consta como <strong>entregue</strong>. Esperamos que chegue tudo certo!</p>${summary}`;
        if (isBlank) {
          body += `<p>Qualquer problema com o material, é só chamar no WhatsApp.</p>`;
        } else if (cardOnly) {
          body += cardUsageTips();
        } else if (isRevenda) {
          body += activationTutorial();
        } else {
          body += usageTips();
        }
        body += `<p style="margin-top:16px;">Deu tudo certo? Conta pra gente no WhatsApp ou no Instagram — e se precisar de ajuda com a configuração, estamos por aqui.</p>`;
        break;
    }

    const html = emailShell({ title: TITLES[event], bodyHtml: body });
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

/** Avisa o dono quando alguém deixa o WhatsApp na ferramenta grátis, pra ele seguir manualmente. */
export async function notifyAdminNewLead(lead: { businessName: string; whatsapp: string | null }) {
  const to = process.env["ADMIN_NOTIFY_EMAIL"];
  if (!to) return { skipped: true, reason: "ADMIN_NOTIFY_EMAIL ausente" };
  const html = emailShell({
    title: "Novo lead da ferramenta grátis",
    bodyHtml:
      `<p><strong>${escapeHtml(lead.businessName)}</strong> usou o gerador de link e pediu contato.</p>` +
      (lead.whatsapp
        ? `<p><a href="${whatsappLink(lead.whatsapp, `Oi! Vi que você gerou o link de avaliação do ${lead.businessName} no nosso site.`)}" style="color:#1A1A1A;font-weight:700;">Chamar no WhatsApp (${escapeHtml(lead.whatsapp)}) →</a></p>`
        : `<p>Não deixou WhatsApp.</p>`),
  });
  try {
    return await sendWithResend({ to, subject: `🎯 Novo lead: ${lead.businessName}`, html });
  } catch (error) {
    console.error("Falha ao notificar admin sobre lead", error);
    return { sent: false };
  }
}

export async function sendPaymentLinkEmail(
  order: {
    order_number: number;
    customer_name: string;
    customer_email: string;
    total_cents: number;
  },
  paymentUrl: string,
) {
  const html = emailShell({
    title: "Finalize seu pagamento",
    bodyHtml:
      `<p>Olá, ${escapeHtml(order.customer_name)}.</p>` +
      `<p>Seu pedido <strong>#${escapeHtml(order.order_number)}</strong> está reservado e aguardando pagamento.</p>` +
      `<p style="margin:16px 0;padding:12px 16px;background:#F4F3F0;border-radius:12px;font-weight:700;">Total: R$ ${(Number(order.total_cents ?? 0) / 100).toFixed(2).replace(".", ",")}</p>` +
      `<p><a href="${escapeHtml(paymentUrl)}" style="display:inline-block;background:#F5B800;color:#1A1A1A;padding:14px 22px;border-radius:12px;font-weight:800;text-decoration:none;">Pagar agora</a></p>` +
      `<p>Se o botão não abrir, copie este link:</p><p style="word-break:break-all;font-size:12px;color:#666;">${escapeHtml(paymentUrl)}</p>` +
      `<p>Se você já realizou o pagamento, pode desconsiderar esta mensagem.</p>`,
  });
  return sendWithResend({
    to: order.customer_email,
    subject: `Finalize o pagamento do pedido #${order.order_number}`,
    html,
  });
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
