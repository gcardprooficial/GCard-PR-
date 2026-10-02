/* eslint-disable @typescript-eslint/no-explicit-any */
import { markRead } from "./transport.server";

export type Inbound = {
  waId: string; // só dígitos, com 55
  name: string | null;
  messageId: string;
  text: string | null;
  kind: "text" | "audio" | "image" | "sticker" | "other";
  buttonId: string | null;
  fromMe: boolean; // mensagem escrita pelo dono direto no celular (Z-API)
};

/** Caminho único de entrada, igual pra Z-API e Meta: grava, dedupe, atualiza contadores e aciona o bot. */
export async function ingestInbound(m: Inbound): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const now = new Date().toISOString();
  const preview =
    m.text ?? (m.kind === "audio" ? "🎤 áudio" : m.kind === "image" ? "📷 imagem" : m.kind === "sticker" ? "🙂 figurinha" : "mensagem");

  let { data: conv } = await db.from("wa_conversations").select("*").eq("wa_id", m.waId).maybeSingle();
  if (!conv) {
    const ins = await db
      .from("wa_conversations")
      .insert({ wa_id: m.waId, name: m.fromMe ? null : m.name })
      .select("*")
      .single();
    conv = ins.data;
    // Conversa nova: já etiqueta (se for cliente que comprou no site, aparece como "Cliente" na hora).
    await db.rpc("wa_sync_contacts").then(
      () => undefined,
      () => undefined,
    );
  }
  if (!conv) return;

  // Dono respondeu pelo celular: registra e silencia o bot nessa conversa.
  if (m.fromMe) {
    const { error: dup } = await db.from("wa_messages").insert({
      conversation_id: conv.id,
      direction: "out",
      sender: "humano",
      kind: m.kind,
      body: m.text,
      wa_message_id: m.messageId,
    });
    if (dup) return; // era mensagem enviada pelo próprio sistema (já gravada)
    await db
      .from("wa_conversations")
      .update({ status: "humano", last_text: preview, last_message_at: now })
      .eq("id", conv.id);
    return;
  }

  // Dedupe: provedor reenvia o webhook se demorar a responder.
  const { error: dup } = await db.from("wa_messages").insert({
    conversation_id: conv.id,
    direction: "in",
    sender: "cliente",
    kind: m.kind,
    body: m.text,
    wa_message_id: m.messageId,
  });
  if (dup) return;

  await db
    .from("wa_conversations")
    .update({
      name: conv.name ?? m.name,
      unread_count: (conv.unread_count ?? 0) + 1,
      last_text: preview,
      last_message_at: now,
      last_inbound_at: now,
    })
    .eq("id", conv.id);

  void markRead(m.waId, m.messageId);

  // Freio anti-loop (ex.: outro robô do outro lado): muitas respostas do bot em pouco tempo = passa pra equipe.
  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  const { count } = await db
    .from("wa_messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conv.id)
    .eq("sender", "bot")
    .gte("created_at", since);
  if ((count ?? 0) >= 25) {
    await db.from("wa_conversations").update({ status: "humano" }).eq("id", conv.id);
    return;
  }

  try {
    const { processInbound } = await import("./bot.server");
    await processInbound(conv, m.kind, m.text, m.buttonId);
  } catch (error) {
    console.error("WhatsApp bot falhou", { conversation: conv.id, error });
  }
}
