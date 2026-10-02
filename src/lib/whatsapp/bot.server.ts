/* eslint-disable @typescript-eslint/no-explicit-any */
import { money, resolveUnitPrice, type PriceTier } from "@/lib/pricing";
import { pixDiscountActive, PIX_DISCOUNT_PCT } from "@/lib/promo";
import { sendAudio, sendText } from "./transport.server";

export type Conv = { id: string; wa_id: string; name: string | null; status: string };
type QuickReply = {
  id: string;
  title: string;
  keywords: string[];
  body: string;
  audio_path: string | null;
  sort_order: number;
};

async function admin(): Promise<any> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

// ---------------------------------------------------------------------------
// Catálogo ao vivo: preço/modelo nunca ficam escritos em texto fixo (senão desatualizam).
// ---------------------------------------------------------------------------
async function catalogTexts(): Promise<{ precos: string; modelos: string }> {
  const db = await admin();
  const [products, plans, planTiers, productTiers] = await Promise.all([
    db.from("products").select("*").eq("status", "ativo").order("sort_order"),
    db.from("plans").select("*").eq("is_active", true).order("sort_order"),
    db.from("plan_price_tiers").select("plan_id, min_quantity, unit_price_cents, label"),
    db.from("product_price_tiers").select("product_id, min_quantity, unit_price_cents, label"),
  ]);

  const planList = (plans.data ?? []).map((p: any) => ({
    ...p,
    tiers: (planTiers.data ?? [])
      .filter((t: any) => t.plan_id === p.id)
      .map(({ plan_id: _x, ...t }: any) => t) as PriceTier[],
  }));
  const lojista = planList.find((p: any) => !p.is_resale);
  const resalePlans = planList.filter((p: any) => p.is_resale);

  const precoBlocks: string[] = [];
  const modeloBlocks: string[] = [];

  for (const prod of products.data ?? []) {
    const rTiers: PriceTier[] = (productTiers.data ?? [])
      .filter((t: any) => t.product_id === prod.id)
      .map(({ product_id: _x, ...t }: any) => t);
    const pricedProduct = { ...prod, resale_tiers: rTiers };
    const lines: string[] = [];

    if (prod.is_blank) {
      if (rTiers.length) {
        lines.push(
          `• ${rTiers.map((t) => `${t.min_quantity} un: ${money(t.unit_price_cents)}`).join(" · ")} (frete grátis)`,
        );
      }
      const colors = (prod.color_variants ?? []) as { name: string; delta_cents: number }[];
      if (colors.length > 1) lines.push(`• Cores: ${colors.map((c) => c.name).join(", ")}`);
      if (prod.nfc_addon_price_cents) {
        lines.push(`• Chip NFC avulso opcional: +${money(prod.nfc_addon_price_cents)} por chip`);
      }
    } else {
      if (lojista) {
        const unit = resolveUnitPrice(lojista, pricedProduct, 1, false);
        lines.push(`• Uso no seu negócio: ${money(unit)} por unidade (preço único, qualquer quantidade)`);
      }
      if (rTiers.length) {
        lines.push(
          `• Revenda: ${rTiers.map((t) => `${t.min_quantity} un: ${money(t.unit_price_cents)}`).join(" · ")}`,
        );
      } else if (resalePlans.length) {
        lines.push(
          `• Revenda: ${resalePlans
            .map(
              (p: any) =>
                `a partir de ${p.min_quantity} un: ${money(resolveUnitPrice(p, pricedProduct, p.min_quantity, true))}`,
            )
            .join(" · ")}`,
        );
      }
    }

    precoBlocks.push(`*${prod.name}*\n${lines.join("\n")}`);
    modeloBlocks.push(
      `• *${prod.name}*${prod.format ? ` (${prod.format})` : ""}${prod.tagline ? ` — ${prod.tagline}` : ""}${
        prod.is_blank ? `, kit mínimo de ${prod.min_quantity} un` : ""
      }`,
    );
  }

  let precos = precoBlocks.join("\n\n");
  if (pixDiscountActive()) precos += `\n\n💸 ${PIX_DISCOUNT_PCT}% de desconto pagando no Pix (promoção por tempo limitado)`;
  return { precos, modelos: modeloBlocks.join("\n") };
}

export async function render(template: string): Promise<string> {
  if (!template.includes("{{")) return template;
  const { precos, modelos } = await catalogTexts();
  return template.replaceAll("{{precos}}", precos).replaceAll("{{modelos}}", modelos);
}

// ---------------------------------------------------------------------------
// Envio + registro
// ---------------------------------------------------------------------------
export async function record(
  convId: string,
  sender: "bot" | "humano",
  kind: string,
  body: string | null,
  waMessageId: string | null,
  mediaPath: string | null = null,
) {
  const db = await admin();
  await db.from("wa_messages").insert({
    conversation_id: convId,
    direction: "out",
    sender,
    kind,
    body,
    media_path: mediaPath,
    wa_message_id: waMessageId,
  });
  await db
    .from("wa_conversations")
    .update({ last_text: body ?? "🎤 áudio", last_message_at: new Date().toISOString() })
    .eq("id", convId);
}

function mimeFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "ogg" || ext === "opus") return "audio/ogg";
  if (ext === "mp3") return "audio/mpeg";
  if (ext === "m4a") return "audio/mp4";
  if (ext === "aac") return "audio/aac";
  if (ext === "amr") return "audio/amr";
  return "audio/mpeg";
}

export async function deliverAudio(conv: Conv, audioPath: string, sender: "bot" | "humano") {
  const db = await admin();
  const { data, error } = await db.storage.from("wa-audio").download(audioPath);
  if (error || !data) throw new Error("Áudio não encontrado no armazenamento.");
  const bytes = new Uint8Array(await data.arrayBuffer());
  const id = await sendAudio(conv.wa_id, bytes, mimeFor(audioPath));
  await record(conv.id, sender, "audio", null, id, audioPath);
}

export async function say(conv: Conv, text: string, sender: "bot" | "humano" = "bot") {
  const id = await sendText(conv.wa_id, text);
  await record(conv.id, sender, "text", text, id);
}

/** Mensagem escrita por uma pessoa da equipe no painel. */
export async function sendHumanMessage(convId: string, text: string) {
  const db = await admin();
  const { data: conv } = await db.from("wa_conversations").select("*").eq("id", convId).maybeSingle();
  if (!conv) throw new Error("Conversa não encontrada.");
  await say(conv, text, "humano");
  if (conv.status !== "humano") await db.from("wa_conversations").update({ status: "humano" }).eq("id", convId);
}

/** Envia uma resposta rápida (texto + áudio) escolhida manualmente no painel. */
export async function sendQuickReply(convId: string, quickReplyId: string) {
  const db = await admin();
  const [{ data: conv }, { data: qr }] = await Promise.all([
    db.from("wa_conversations").select("*").eq("id", convId).maybeSingle(),
    db.from("wa_quick_replies").select("*").eq("id", quickReplyId).maybeSingle(),
  ]);
  if (!conv || !qr) throw new Error("Conversa ou resposta não encontrada.");
  await say(conv, await render(qr.body), "humano");
  if (qr.audio_path) await deliverAudio(conv, qr.audio_path, "humano");
  if (conv.status !== "humano") await db.from("wa_conversations").update({ status: "humano" }).eq("id", convId);
}

// ---------------------------------------------------------------------------
// Casamento por palavra-chave
// ---------------------------------------------------------------------------
export const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

function matchQuickReply(text: string, replies: QuickReply[]): QuickReply | null {
  const t = norm(text);
  let best: { qr: QuickReply; score: number } | null = null;
  for (const qr of replies) {
    let score = 0;
    for (const raw of qr.keywords) {
      const kw = norm(raw);
      if (!kw) continue;
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(t)) score += kw.length;
    }
    if (score > 0 && (!best || score > best.score || (score === best.score && qr.sort_order < best.qr.sort_order))) {
      best = { qr, score };
    }
  }
  return best?.qr ?? null;
}

// ---------------------------------------------------------------------------
// Prazo por CEP: cotação real (Melhor Envio) saindo de Indaiatuba/SP. Preço NUNCA é mostrado.
// ---------------------------------------------------------------------------
export const CEP_RE = /(?<!\d)(\d{5})-?(\d{3})(?!\d)/;

export async function cepReply(cep: string): Promise<string> {
  let place = "";
  try {
    const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: AbortSignal.timeout(5_000) });
    const j = (await r.json()) as { erro?: boolean; localidade?: string; uf?: string };
    if (j.erro) return "Não achei esse CEP 🤔 Confere os 8 números e me manda de novo?";
    if (j.localidade) place = ` para ${j.localidade}/${j.uf}`;
  } catch {
    /* ViaCEP fora do ar: segue sem o nome da cidade */
  }

  const total = "Somando a produção, o prazo total (produção + envio) é de 5 a 10 dias úteis, com frete grátis.";
  try {
    const { calculateFreight } = await import("@/lib/shipping/melhorenvio.server");
    const q = await calculateFreight({ destinationCep: cep, profile: "acrilico", quantity: 10 });
    const days = q.ok ? q.quotes.map((x) => x.deliveryDays).filter((d): d is number => d != null) : [];
    if (days.length) {
      const lo = Math.min(...days);
      const hi = Math.max(...days);
      const trans = lo === hi ? `${lo} dias úteis` : `${lo} a ${hi} dias úteis`;
      return `Saindo de Indaiatuba/SP${place}, a transportadora leva em torno de ${trans} depois que o pedido é despachado 🚚\n\n${total}\n\nQuer fazer o pedido? https://www.gcardpro.com.br/comprar`;
    }
  } catch (error) {
    console.error("whatsapp bot: falha ao cotar prazo", error);
  }
  return `Saindo de Indaiatuba/SP${place}: ${total}`;
}

const GREETING = /^(oi+|ola|opa|e ai|eai|bom dia|boa tarde|boa noite|tudo bem|tudo bom|hey|hello|salve)[\s!.,?]*$/;
const WANTS_HUMAN = /(atendente|humano|pessoa|falar com (alguem|voce)|vendedor|responsavel)/;

const WELCOME =
  "Oi! 👋 Eu sou o assistente virtual da GCard-PRÓ.\n\nPosso te ajudar com:\n• Valores\n• Modelos\n• Prazo de entrega\n• Se a empresa é confiável\n• Como configurar o QR Code e o NFC\n\nÉ só escrever o que você precisa. Se preferir falar com uma pessoa, escreva *atendente*.";

const HANDOFF =
  "Certo! Já chamei alguém da equipe pra te responder por aqui. Em breve você recebe a resposta 🙂";

// ---------------------------------------------------------------------------
// IA (Claude) -- responde só com base nos fatos do negócio; não sabe = chama humano
// ---------------------------------------------------------------------------
const FACTS = `
EMPRESA: GCard-PRÓ (Marusso Produções, CNPJ 68.194.199/0001-70, Indaiatuba/SP). Fornecedor direto. Instagram: @gcardpro.oficial. Site: https://www.gcardpro.com.br
O QUE É: cartões e placas de acrílico com NFC e QR Code que levam o cliente direto à tela de avaliação do Google do negócio. O QR Code é dinâmico: guarda um código, não o link, então dá pra trocar o link da avaliação quando quiser, sem reimprimir.
SEM MENSALIDADE: paga uma vez e usa pra sempre. Nenhum custo recorrente.
FRETE: grátis para todo o Brasil, pelos Correios (PAC ou Sedex conforme o prazo disponível).
PRAZO: produção + envio de 5 a 10 dias úteis. O código de rastreio vai por e-mail quando o pedido é despachado.
PAGAMENTO: Mercado Pago (cartão ou Pix) no site. Compra em https://www.gcardpro.com.br/comprar
COMPATIBILIDADE NFC: iPhone XS ou mais novo e a maioria dos Androids com NFC. O QR Code funciona em qualquer celular com câmera.
CONFIGURAR (uso no próprio negócio): o cliente informa o negócio na compra e a GCard grava o link antes de enviar; chega pronto.
CONFIGURAR (revenda/troca de link): escanear o QR da placa mostra o código dela (ex.: GCARD-00061); entrar em https://www.gcardpro.com.br/ativar com o e-mail da compra; achar a placa pelo código; colar o link de avaliação do Google do cliente.
VÍDEOS: configurar QR Code https://youtube.com/shorts/zeA8QT-3Ltc · configurar NFC https://youtube.com/shorts/q8W2ojaF5vE
ACRÍLICO LISO (sem arte): placa de acrílico 2mm sem impressão, kit mínimo de 10 unidades, frete grátis; chip NFC avulso é opcional e cobrado à parte por unidade.
`.trim();

async function askAi(history: { role: "user" | "assistant"; content: string }[]): Promise<string | null> {
  const key = process.env["ANTHROPIC_API_KEY"];
  if (!key) return null;
  const db = await admin();
  const [{ precos, modelos }, { data: know }] = await Promise.all([
    catalogTexts(),
    db.from("wa_knowledge").select("question, answer").order("created_at", { ascending: false }).limit(60),
  ]);
  const learned = (know ?? []).map((k: any) => `P: ${k.question}\nR: ${k.answer}`).join("\n\n");

  const system = `Você atende clientes da GCard-PRÓ pelo WhatsApp, em português do Brasil, com tom simpático, direto e curto (máx. 5 linhas, no máximo 1 emoji). Escreva como mensagem de WhatsApp (sem markdown, só *negrito* com asteriscos simples quando ajudar).

REGRAS INQUEBRÁVEIS:
1. Responda SOMENTE com base nos FATOS, no CATÁLOGO e nas RESPOSTAS APROVADAS abaixo. Nunca invente preço, prazo, garantia, desconto, característica ou política.
2. Se a pergunta não estiver coberta, ou envolver um pedido específico do cliente (status, rastreio, problema, troca, reembolso, reclamação), negociação de preço/desconto, pagamento com problema, ou qualquer dúvida sua, responda EXATAMENTE: [HUMANO]
3. Valores sempre iguais aos do CATÁLOGO. Não calcule descontos que não estejam no catálogo.
4. Nunca peça dados sensíveis (senha, cartão, CPF).
5. Quando fizer sentido, convide a comprar em https://www.gcardpro.com.br/comprar

FATOS:
${FACTS}

CATÁLOGO (preços atuais):
${precos}

MODELOS:
${modelos}

RESPOSTAS APROVADAS PELA EQUIPE:
${learned || "(nenhuma ainda)"}`;

  // A API exige alternância user/assistant começando por user.
  const messages: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of history) {
    const last = messages[messages.length - 1];
    if (last && last.role === m.role) last.content += `\n${m.content}`;
    else messages.push({ ...m });
  }
  while (messages.length && messages[0]!.role !== "user") messages.shift();
  if (!messages.length) return null;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 400, system, messages }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    console.error("whatsapp bot: erro da IA", res.status, await res.text().catch(() => ""));
    return null;
  }
  const json = (await res.json()) as { content?: { type: string; text?: string }[] };
  return json.content?.find((c) => c.type === "text")?.text?.trim() ?? null;
}

export async function handoff(conv: Conv, announce = true) {
  const db = await admin();
  await db.from("wa_conversations").update({ status: "humano" }).eq("id", conv.id);
  if (announce) await say(conv, HANDOFF);
  // Aviso por e-mail pra equipe, se o Resend estiver configurado (opcional, nunca bloqueia).
  try {
    const to = process.env["ADMIN_NOTIFY_EMAIL"];
    const resend = process.env["RESEND_API_KEY"];
    if (to && resend) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resend}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env["RESEND_FROM"] ?? "GCard-PRÓ <noreply@gcardpro.com.br>",
          to,
          subject: `WhatsApp: ${conv.name ?? conv.wa_id} precisa de atendente`,
          text: `Uma conversa foi encaminhada pra equipe. Abra o painel: https://www.gcardpro.com.br/painel/whatsapp`,
        }),
      });
    }
  } catch (error) {
    console.error("whatsapp bot: falha ao avisar equipe", error);
  }
}

// ---------------------------------------------------------------------------
// Entrada: chamado pelo webhook a cada mensagem recebida
// ---------------------------------------------------------------------------
export async function processInbound(
  conv: Conv,
  kind: string,
  text: string | null,
  buttonId: string | null = null,
) {
  const db = await admin();

  // Equipe já assumiu: bot fica quieto.
  if (conv.status === "humano") return;
  if (conv.status === "resolvido") {
    await db.from("wa_conversations").update({ status: "bot" }).eq("id", conv.id);
    conv.status = "bot";
  }

  const flows = await import("./flow.server");

  // Cliente no meio de um fluxo (clicou num botão / respondeu uma pergunta).
  if (await flows.resumeFlow(conv as any, kind, text, buttonId)) return;

  // Áudio/imagem/etc: fluxo com esse gatilho, senão passa pra pessoa.
  if (kind !== "text" || !text) {
    if (await flows.triggerFlow(conv, "specific", kind, text, buttonId, false)) return;
    await handoff(conv);
    return;
  }

  const t = norm(text);
  if (WANTS_HUMAN.test(t)) {
    await handoff(conv);
    return;
  }

  const cepMatch = text.match(CEP_RE);
  if (cepMatch) {
    await say(conv, await cepReply(`${cepMatch[1]}${cepMatch[2]}`));
    return;
  }

  if (await flows.triggerFlow(conv, "specific", kind, text, buttonId, false)) return;

  const { data: replies } = await db
    .from("wa_quick_replies")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  const hit = matchQuickReply(text, (replies ?? []) as QuickReply[]);
  if (hit) {
    await say(conv, await render(hit.body));
    if (hit.audio_path) {
      try {
        await deliverAudio(conv, hit.audio_path, "bot");
      } catch (error) {
        console.error("whatsapp bot: falha ao enviar áudio", error);
      }
    }
    return;
  }

  const { count: sentBefore } = await db
    .from("wa_messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conv.id)
    .eq("direction", "out");
  const firstOrGreeting = (sentBefore ?? 0) === 0 || GREETING.test(t);
  if (await flows.triggerFlow(conv, "fallback", kind, text, buttonId, firstOrGreeting)) return;

  if (GREETING.test(t)) {
    await say(conv, WELCOME);
    return;
  }

  await aiReply(conv);
}

/** Resposta da IA (ou passa pra equipe). Retorna true se a IA respondeu. */
export async function aiReply(conv: Conv): Promise<boolean> {
  const db = await admin();
  const { data: setting } = await db.from("app_settings").select("value").eq("key", "wa_ai").maybeSingle();
  const aiOn = setting?.value?.enabled !== false;
  if (!aiOn) {
    await handoff(conv);
    return false;
  }

  const { data: recent } = await db
    .from("wa_messages")
    .select("direction, body")
    .eq("conversation_id", conv.id)
    .not("body", "is", null)
    .order("created_at", { ascending: false })
    .limit(10);
  const history = ((recent ?? []) as { direction: string; body: string }[])
    .reverse()
    .map((m) => ({ role: m.direction === "in" ? ("user" as const) : ("assistant" as const), content: m.body }));

  let answer: string | null = null;
  try {
    answer = await askAi(history);
  } catch (error) {
    console.error("whatsapp bot: IA falhou", error);
  }

  if (!answer || answer.includes("[HUMANO]")) {
    await handoff(conv);
    return false;
  }
  await say(conv, answer);
  return true;
}