import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { rateLimitShared, clientKey } from "@/lib/rateLimit";
import { untyped } from "@/lib/db-untyped";

// Chat do site: o visitante conversa sem conta (identificado por um código guardado no navegador dele) e a equipe responde
// pelo painel ou pelo Hub. Só gravamos o que a pessoa digita; nada de anexo. O gatilho do banco manda o evento ao Hub
// quando há e-mail.

const tokenSchema = z
  .string()
  .trim()
  .min(24)
  .max(80)
  .regex(/^[A-Za-z0-9_-]+$/);
const textSchema = z.string().trim().min(1).max(2000);

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return untyped(supabaseAdmin);
}

async function assertTeam(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "staff"]);
  if (error) throw error;
  if (!data?.length) throw new Error("Sem permissão para esta ação.");
}

export type ChatMessage = {
  id: string;
  sender_type: "visitor" | "staff";
  /** Quem respondeu (equipe): "Leonardo · GCard", "Paulo · GCard" ou "Equipe GCard · Hub". */
  sender_name?: string | null;
  body: string;
  created_at: string;
};

/** Primeira mensagem (cria a conversa com nome e e-mail) ou mensagem seguinte da mesma conversa. */
export const chatSend = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        token: tokenSchema,
        message: textSchema,
        name: z.string().trim().min(2).max(80).optional(),
        email: z.string().trim().toLowerCase().email().max(160).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const key = clientKey(getRequest());
    if (
      !(await rateLimitShared(`chat:ip:${key}`, 20, 60_000)) ||
      !(await rateLimitShared(`chat:t:${data.token}`, 8, 60_000))
    ) {
      return { ok: false as const, error: "Muitas mensagens. Aguarde um minuto." };
    }
    const sb = await db();
    const { data: found } = await sb
      .from("chat_conversations")
      .select("id, visitor_name, visitor_email, status")
      .eq("visitor_token", data.token)
      .maybeSingle();
    let conv = found as {
      id: string;
      visitor_name: string | null;
      visitor_email: string | null;
      status: string;
    } | null;
    if (!conv) {
      if (!data.name || !data.email)
        return { ok: false as const, error: "Informe seu nome e e-mail para começar." };
      const { data: created, error } = await sb
        .from("chat_conversations")
        .insert({ visitor_token: data.token, visitor_name: data.name, visitor_email: data.email })
        .select("id, visitor_name, visitor_email, status")
        .single();
      if (error) {
        console.error("[chat] falha ao criar conversa", error.code);
        return { ok: false as const, error: "Não consegui enviar agora. Chame no WhatsApp." };
      }
      conv = created;
    }
    const { error: msgError } = await sb.from("chat_messages").insert({
      conversation_id: conv!.id,
      sender_type: "visitor",
      sender_name: conv!.visitor_name,
      body: data.message,
    });
    if (msgError) {
      console.error("[chat] falha ao gravar mensagem", msgError.code);
      return { ok: false as const, error: "Não consegui enviar agora. Chame no WhatsApp." };
    }
    await sb
      .from("chat_conversations")
      .update({ last_message_at: new Date().toISOString(), status: "aberta" })
      .eq("id", conv!.id);
    if (conv!.visitor_email && (await rateLimitShared(`chat:aviso:${conv!.id}`, 1, 600_000))) {
      const { notifyAdminChatMessage } = await import("@/lib/email-events.server");
      await notifyAdminChatMessage({
        name: conv!.visitor_name ?? "Visitante",
        email: conv!.visitor_email,
        text: data.message,
      });
    }
    return { ok: true as const };
  });

/** A conversa do próprio visitante (pelo código do navegador). */
export const chatGet = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: tokenSchema }).parse(input))
  .handler(async ({ data }) => {
    if (!(await rateLimitShared(`chat:get:${data.token}`, 40, 60_000)))
      return { messages: [] as ChatMessage[], started: false };
    const sb = await db();
    const { data: conv } = await sb
      .from("chat_conversations")
      .select("id")
      .eq("visitor_token", data.token)
      .maybeSingle();
    if (!conv) return { messages: [] as ChatMessage[], started: false };
    const { data: rows } = await sb
      .from("chat_messages")
      .select("id, sender_type, body, created_at")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: true })
      .limit(200);
    return { messages: (rows ?? []) as ChatMessage[], started: true };
  });

// ---------------------------------------------------------------- equipe

export type ChatConversation = {
  id: string;
  visitor_name: string | null;
  visitor_email: string | null;
  status: "aberta" | "fechada";
  last_message_at: string;
  last_text: string | null;
  last_from: "visitor" | "staff" | null;
};

const PAGE = 30;

/** Conversas, mais recentes primeiro, de 30 em 30. */
export const staffChatList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        page: z.number().int().min(0).max(500),
        status: z.enum(["aberta", "fechada", "todas"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertTeam(context.userId);
    const sb = await db();
    let q = sb
      .from("chat_conversations")
      .select("id, visitor_name, visitor_email, status, last_message_at")
      .order("last_message_at", { ascending: false })
      .range(data.page * PAGE, data.page * PAGE + PAGE);
    if (data.status !== "todas") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw error;
    const list = (rows ?? []) as Omit<ChatConversation, "last_text" | "last_from">[];
    const more = list.length > PAGE;
    const page = list.slice(0, PAGE);
    const ids = page.map((c) => c.id);
    const last = new Map<string, { body: string; sender_type: "visitor" | "staff" }>();
    if (ids.length) {
      const { data: msgs } = await sb
        .from("chat_messages")
        .select("conversation_id, body, sender_type, created_at")
        .in("conversation_id", ids)
        .order("created_at", { ascending: false })
        .limit(ids.length * 4);
      for (const m of (msgs ?? []) as {
        conversation_id: string;
        body: string;
        sender_type: "visitor" | "staff";
      }[])
        if (!last.has(m.conversation_id)) last.set(m.conversation_id, m);
    }
    return {
      more,
      items: page.map((c) => ({
        ...c,
        last_text: last.get(c.id)?.body?.slice(0, 120) ?? null,
        last_from: last.get(c.id)?.sender_type ?? null,
      })) as ChatConversation[],
    };
  });

export const staffChatThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertTeam(context.userId);
    const sb = await db();
    const { data: rows } = await sb
      .from("chat_messages")
      .select("id, sender_type, sender_name, body, created_at")
      .eq("conversation_id", data.id)
      .order("created_at", { ascending: true })
      .limit(500);
    return { messages: (rows ?? []) as ChatMessage[] };
  });

export const staffChatReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), text: textSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertTeam(context.userId);
    const sb = await db();
    // O nome de quem responde aparece na conversa (Leonardo, Paulo...), para a equipe saber quem já falou.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const meta = (u?.user?.user_metadata ?? {}) as Record<string, unknown>;
    const raw = String(
      meta["full_name"] ?? meta["name"] ?? u?.user?.email?.split("@")[0] ?? "Equipe",
    );
    const first = raw.trim().split(/[\s._-]+/)[0] ?? "Equipe";
    const who = (first.charAt(0).toUpperCase() + first.slice(1)).slice(0, 30) || "Equipe";
    const { error } = await sb.from("chat_messages").insert({
      conversation_id: data.id,
      sender_type: "staff",
      sender_name: `${who} · GCard`,
      body: data.text,
    });
    if (error) throw error;
    await sb
      .from("chat_conversations")
      .update({ last_message_at: new Date().toISOString(), status: "aberta" })
      .eq("id", data.id);
    return { ok: true as const };
  });

export const staffChatStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["aberta", "fechada"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertTeam(context.userId);
    const sb = await db();
    const { error } = await sb
      .from("chat_conversations")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true as const };
  });

/** Quantas conversas abertas esperam resposta (a última mensagem é do visitante). Alimenta o aviso do menu. */
export const staffChatUnread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertTeam(context.userId);
    const sb = await db();
    const { data: convs } = await sb
      .from("chat_conversations")
      .select("id")
      .eq("status", "aberta")
      .order("last_message_at", { ascending: false })
      .limit(50);
    const ids = ((convs ?? []) as { id: string }[]).map((c) => c.id);
    if (!ids.length) return { count: 0 };
    const { data: msgs } = await sb
      .from("chat_messages")
      .select("conversation_id, sender_type, created_at")
      .in("conversation_id", ids)
      .order("created_at", { ascending: false })
      .limit(ids.length * 4);
    const last = new Map<string, "visitor" | "staff">();
    for (const m of (msgs ?? []) as { conversation_id: string; sender_type: "visitor" | "staff" }[])
      if (!last.has(m.conversation_id)) last.set(m.conversation_id, m.sender_type);
    return { count: [...last.values()].filter((t) => t === "visitor").length };
  });
