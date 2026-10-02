/* eslint-disable @typescript-eslint/no-explicit-any */
import { carrierLabel, trackingUrl } from "@/lib/shipping";
import { phoneExists } from "./zapi.server";
import { provider, sendText } from "./transport.server";

/**
 * Espelho dos e-mails de pedido no WhatsApp: mesmos eventos, mesmas informações e links, texto curto.
 * Só envia pela Z-API (na API oficial da Meta, mensagem proativa exige template aprovado).
 * Regras de segurança do número: 1 aviso por pedido+evento, limite diário, só pra quem informou o
 * número no checkout, confere se o número tem WhatsApp, e quem responder PARAR não recebe mais.
 */
export type NotifyEvent =
  | "pedido_recebido"
  | "pagamento_pendente"
  | "pagamento_confirmado"
  | "lote_criado"
  | "em_producao"
  | "pedido_enviado"
  | "pedido_entregue";

const OPT_OUT_LABEL = "Sem avisos";
const FOOTER = "\n\n_Pra não receber avisos por aqui, responda PARAR._";
const DAILY_CAP = () => Number(process.env["WA_NOTIFY_DAILY_CAP"] ?? 80);

const siteUrl = () => (process.env["PUBLIC_APP_URL"] ?? "https://www.gcardpro.com.br").replace(/\/$/, "");
const brl = (cents: number) => `R$ ${(Number(cents ?? 0) / 100).toFixed(2).replace(".", ",")}`;

/** Número do checkout (texto livre) -> 55 + DDD + número, ou null se não parecer telefone BR. */
export function normalizeBrPhone(raw: string | null | undefined): string | null {
  let d = String(raw ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  return /^55\d{10,11}$/.test(d) ? d : null;
}

const videos = () =>
  "▶️ QR Code: https://youtube.com/shorts/zeA8QT-3Ltc\n▶️ NFC: https://youtube.com/shorts/q8W2ojaF5vE";

const activation = () =>
  `Como ativar cada placa:\n1) Escaneie o QR dela: abre uma página com o código (ex.: GCARD-00061)\n2) Entre em ${siteUrl()}/ativar com o e-mail da compra\n3) Informe o negócio e cole o link de avaliação do Google\n${videos()}`;

type Ctx = {
  order: any;
  items: { product_name: string; quantity: number; products?: { is_blank?: boolean; has_qr?: boolean } | null }[];
  first: string;
  isBlank: boolean;
  cardOnly: boolean;
  isRevenda: boolean;
  batch: { code: string; codes: string[] } | null;
  paymentUrl?: string | undefined;
};

const itemsLines = (c: Ctx) => c.items.map((i) => `• ${i.quantity}x ${i.product_name}`).join("\n");

function usageTips(c: Ctx): string {
  if (c.cardOnly) return "Como usar: o cliente aproxima o celular do cartão (NFC) e a avaliação abre.";
  return "Como usar: o cliente aponta a câmera pro QR Code (ou aproxima o celular, se tiver NFC).";
}

function build(event: NotifyEvent, c: Ctx): string {
  const o = c.order;
  const head = `Olá, ${c.first}! `;
  switch (event) {
    case "pedido_recebido":
      return `${head}👋 Recebemos o seu pedido *#${o.order_number}*:\n${itemsLines(c)}\nTotal: ${brl(o.total_cents)}\n\nAssim que o pagamento for confirmado, avisamos por aqui.${FOOTER}`;

    case "pagamento_pendente":
      return (
        `${head}Seu pedido *#${o.order_number}* está reservado, mas falta o pagamento (${brl(o.total_cents)}).\n` +
        (c.paymentUrl
          ? `\n💳 Pague aqui (Pix, cartão ou boleto, sem precisar de conta): ${c.paymentUrl}\n\nSe já pagou, pode ignorar. 😉`
          : `\nSe quiser, responda aqui que enviamos um novo link de pagamento.`) +
        FOOTER
      );

    case "pagamento_confirmado": {
      let t = `${head}✅ Recebemos o pagamento do pedido *#${o.order_number}*. Obrigado!\n${itemsLines(c)}\n\n`;
      if (c.isBlank) {
        t += "Seu pedido é de *acrílico puro* (sem impressão, QR ou NFC), pra você aplicar a sua arte. Avisamos quando entrar em produção e quando for enviado.";
      } else if (c.cardOnly && c.isRevenda) {
        t += `Estamos separando os seus cartões de PVC com NFC. Avisamos quando entrar em produção e quando forem enviados.\n▶️ Como configurar o NFC: https://youtube.com/shorts/q8W2ojaF5vE`;
      } else if (c.isRevenda) {
        t += `As plaquinhas do kit de revenda chegam *sem link configurado*: você ativa cada uma pro negócio do seu cliente. Quando o lote ficar pronto, mandamos o código por aqui.\n\n${activation()}`;
      } else {
        t += "Seu cartão/placa vai *já configurado* com o link de avaliação do seu Google. Avisamos quando entrar em produção e quando for enviado, com o rastreio.";
      }
      return t;
    }

    case "lote_criado": {
      const codes = c.batch?.codes ?? [];
      const list = codes.length ? `\n*Placas (${codes.length}):* ${codes.slice(0, 40).join(", ")}${codes.length > 40 ? "…" : ""}\n(links completos de cada QR no e-mail)` : "";
      return (
        `${head}🎉 O lote das suas plaquinhas está pronto pra ativar!\n` +
        (c.batch?.code ? `*Código do lote:* ${c.batch.code}\n` : "") +
        list +
        `\n\nSe o lote não aparecer na sua conta, cole o código em "Resgatar lote" em ${siteUrl()}/ativar\n\n${activation()}`
      );
    }

    case "em_producao":
      return `${head}🏭 Seu pedido *#${o.order_number}* entrou em *produção*.\n${itemsLines(c)}\n\nAssim que for enviado, mando o código de rastreio.`;

    case "pedido_enviado": {
      const link = o.tracking_code ? trackingUrl(o.tracking_carrier, o.tracking_code) : null;
      let t = `${head}🚚 Seu pedido *#${o.order_number}* foi *enviado*! O frete é por nossa conta.\n${itemsLines(c)}\n`;
      if (o.tracking_code) {
        t += `\n*Transportadora:* ${carrierLabel(o.tracking_carrier)}\n*Rastreio:* ${o.tracking_code}${link ? `\n${link}` : ""}\n`;
      }
      if (c.cardOnly) t += `\n${usageTips(c)}`;
      else if (c.isRevenda && !c.isBlank) {
        const codes = c.batch?.codes ?? [];
        t += `\nAs plaquinhas chegam em branco. Não vem código no papel: escaneie o QR de cada uma pra ver o código.${codes.length ? `\n*Códigos:* ${codes.slice(0, 40).join(", ")}${codes.length > 40 ? "…" : ""}` : ""}\n\n${activation()}`;
      } else if (!c.isBlank) t += `\n${usageTips(c)}\nTrocar o link depois: ${siteUrl()}/ativar (com o e-mail da compra). O QR é dinâmico, não precisa reimprimir.`;
      return t;
    }

    case "pedido_entregue": {
      let t = `${head}✅ O seu pedido *#${o.order_number}* consta como *entregue*. Esperamos que chegue tudo certo!\n`;
      if (c.isBlank) t += "\nQualquer problema com o material, é só chamar aqui.";
      else if (c.cardOnly) t += `\n${usageTips(c)}`;
      else if (c.isRevenda) t += `\n${activation()}`;
      else t += `\n${usageTips(c)}`;
      t += `\n\nDeu tudo certo? Conta pra gente aqui ou no Instagram. 📹 Grava um vídeo rapidinho mostrando o seu GCard-PRÓ e marca @gcardpro.oficial: adoramos repostar!${FOOTER}`;
      return t;
    }
  }
}

async function admin(): Promise<any> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function conversationFor(db: any, waId: string, name: string | null) {
  const { data: found } = await db.from("wa_conversations").select("*").eq("wa_id", waId).maybeSingle();
  if (found) return found;
  const { data } = await db.from("wa_conversations").insert({ wa_id: waId, name }).select("*").single();
  return data;
}

/** Envia o texto, grava na conversa (pra equipe ver o histórico) e devolve se foi. */
async function deliver(db: any, waId: string, name: string | null, text: string): Promise<void> {
  const id = await sendText(waId, text);
  const conv = await conversationFor(db, waId, name);
  if (conv) {
    await db.from("wa_messages").insert({
      conversation_id: conv.id, direction: "out", sender: "bot", kind: "text", body: text, wa_message_id: id,
    });
    await db.from("wa_conversations").update({ last_text: text, last_message_at: new Date().toISOString() }).eq("id", conv.id);
  }
}

async function optedOut(db: any, waId: string): Promise<boolean> {
  const key = waId.slice(2, 4) + waId.slice(-8);
  const { data } = await db.from("wa_contacts").select("labels").eq("phone_key", key).maybeSingle();
  return Boolean(data?.labels?.includes(OPT_OUT_LABEL));
}

async function sentToday(db: any): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const { count } = await db
    .from("wa_order_notifications")
    .select("id", { count: "exact", head: true })
    .eq("status", "sent")
    .gte("created_at", start.toISOString());
  return count ?? 0;
}

async function checks(db: any, waId: string): Promise<string | null> {
  if (await optedOut(db, waId)) return "pediu_para_parar";
  if ((await sentToday(db)) >= DAILY_CAP()) return "limite_diario";
  if ((await phoneExists(waId)) === false) return "numero_sem_whatsapp";
  return null;
}

export async function dispatchOrderWhatsApp(
  orderId: string,
  event: NotifyEvent,
  extra?: { paymentUrl?: string; force?: boolean },
): Promise<{ sent: boolean; reason?: string }> {
  if (provider() !== "zapi") return { sent: false, reason: "sem_zapi" };
  const db = await admin();

  const { data: order } = await db
    .from("orders")
    .select("id, order_number, customer_name, customer_phone, tracking_code, tracking_carrier, total_cents, kind")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { sent: false, reason: "pedido_nao_encontrado" };
  const waId = normalizeBrPhone(order.customer_phone);

  const record = (status: "sent" | "skipped" | "failed", reason?: string) =>
    db.from("wa_order_notifications").insert({ order_id: orderId, event_type: event, wa_id: waId, status, reason: reason ?? null });

  const { data: existing } = await db
    .from("wa_order_notifications")
    .select("id, status")
    .eq("order_id", orderId)
    .eq("event_type", event)
    .maybeSingle();
  if (existing && existing.status === "sent" && !extra?.force) return { sent: false, reason: "idempotente" };
  if (existing) await db.from("wa_order_notifications").delete().eq("id", existing.id);

  if (!waId) {
    await record("skipped", "telefone_invalido");
    return { sent: false, reason: "telefone_invalido" };
  }
  const blocked = await checks(db, waId);
  if (blocked) {
    await record("skipped", blocked);
    return { sent: false, reason: blocked };
  }

  try {
    const { data: itemRows } = await db
      .from("order_items")
      .select("product_name, quantity, products(is_blank, has_qr)")
      .eq("order_id", orderId);
    const items = (itemRows ?? []) as Ctx["items"];
    const isBlank = items.some((i) => i.products?.is_blank);
    const cardOnly = items.length > 0 && items.every((i) => i.products?.has_qr === false && !i.products?.is_blank);

    let batch: Ctx["batch"] = null;
    if (event === "lote_criado" || event === "pedido_enviado") {
      const { data: b } = await db.from("batches").select("id, code").eq("owner_order_id", orderId).maybeSingle();
      if (b) {
        const { data: plates } = await db.from("plates").select("short_code").eq("batch_id", b.id).order("short_code");
        batch = { code: b.code, codes: (plates ?? []).map((p: { short_code: string }) => p.short_code) };
      }
    }

    const text = build(event, {
      order,
      items,
      first: String(order.customer_name ?? "").split(" ")[0] || "cliente",
      isBlank,
      cardOnly,
      isRevenda: order.kind === "revenda",
      batch,
      paymentUrl: extra?.paymentUrl,
    });
    await deliver(db, waId, order.customer_name ?? null, text);
    await record("sent");
    if (event === "pagamento_confirmado") await db.rpc("wa_sync_contacts").then(() => undefined, () => undefined);
    return { sent: true };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error("Falha no aviso por WhatsApp", { orderId, event, error });
    await record("failed", reason.slice(0, 300));
    return { sent: false, reason };
  }
}

/** Link de pagamento enviado à mão pelo painel (equivale ao e-mail "Finalize seu pagamento"). */
export async function sendPaymentLinkWhatsApp(
  order: { order_number: number; customer_name: string; customer_phone?: string | null; total_cents: number },
  paymentUrl: string,
): Promise<{ sent: boolean; reason?: string }> {
  if (provider() !== "zapi") return { sent: false, reason: "sem_zapi" };
  const waId = normalizeBrPhone(order.customer_phone);
  if (!waId) return { sent: false, reason: "telefone_invalido" };
  const db = await admin();
  const blocked = await checks(db, waId);
  if (blocked) return { sent: false, reason: blocked };
  try {
    const first = String(order.customer_name ?? "").split(" ")[0] || "cliente";
    await deliver(
      db,
      waId,
      order.customer_name ?? null,
      `Olá, ${first}! Seu pedido *#${order.order_number}* está reservado e aguardando pagamento (${brl(order.total_cents)}).\n\n💳 Pagar agora: ${paymentUrl}\n\nSe já pagou, pode desconsiderar.${FOOTER}`,
    );
    return { sent: true };
  } catch (error) {
    console.error("Falha ao enviar link de pagamento por WhatsApp", error);
    return { sent: false, reason: error instanceof Error ? error.message : String(error) };
  }
}
