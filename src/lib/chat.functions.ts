import { createServerFn } from "@tanstack/react-start";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const tokenSchema = z.string().trim().min(20).max(120);
const messageSchema = z.string().trim().min(1).max(4000);

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

async function getConversationByToken(token: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any)
    .from("chat_conversations")
    .select("id, visitor_token, visitor_name, visitor_email, status")
    .eq("visitor_token", token)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export const getChat = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ visitorToken: tokenSchema }).parse(input))
  .handler(async ({ data }) => {
    const conversation = await getConversationByToken(data.visitorToken);
    if (!conversation) return { ok: true as const, conversation: null, messages: [] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: messages, error } = await (supabaseAdmin as any)
      .from("chat_messages")
      .select("id, sender_type, sender_name, body, created_at")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return { ok: true as const, conversation, messages: messages ?? [] };
  });

export const sendChatMessage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        visitorToken: tokenSchema,
        body: messageSchema,
        visitorName: z.string().trim().max(120).optional().nullable(),
        visitorEmail: z.string().trim().email().max(160).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let conversation = await getConversationByToken(data.visitorToken);
    if (!conversation) {
      const { data: created, error } = await (supabaseAdmin as any)
        .from("chat_conversations")
        .insert({
          visitor_token: data.visitorToken,
          visitor_name: data.visitorName || null,
          visitor_email: data.visitorEmail || null,
        })
        .select("id, visitor_token, visitor_name, visitor_email, status")
        .single();
      if (error) throw error;
      conversation = created;
    } else if (data.visitorName || data.visitorEmail) {
      const { error } = await (supabaseAdmin as any)
        .from("chat_conversations")
        .update({
          ...(data.visitorName ? { visitor_name: data.visitorName } : {}),
          ...(data.visitorEmail ? { visitor_email: data.visitorEmail } : {}),
          status: "aberta",
        })
        .eq("id", conversation.id);
      if (error) throw error;
    }

    const { data: message, error: messageError } = await (supabaseAdmin as any)
      .from("chat_messages")
      .insert({ conversation_id: conversation.id, sender_type: "visitor", body: data.body })
      .select("id, sender_type, sender_name, body, created_at")
      .single();
    if (messageError) throw messageError;
    await (supabaseAdmin as any)
      .from("chat_conversations")
      .update({ last_message_at: new Date().toISOString(), status: "aberta" })
      .eq("id", conversation.id);
    return { ok: true as const, conversation, message };
  });

export const listChatConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertTeam(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("chat_conversations")
      .select("id, visitor_name, visitor_email, status, last_message_at, created_at")
      .order("last_message_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

const adminConversationSchema = z.object({ conversationId: z.string().uuid() });

export const getChatConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => adminConversationSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertTeam(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: messages, error } = await (supabaseAdmin as any)
      .from("chat_messages")
      .select("id, sender_type, sender_name, body, created_at")
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return messages ?? [];
  });

export const replyToChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    adminConversationSchema.extend({ body: messageSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertTeam(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: message, error } = await (supabaseAdmin as any)
      .from("chat_messages")
      .insert({
        conversation_id: data.conversationId,
        sender_type: "staff",
        sender_name: context.claims.email ?? "Equipe GCard-PRÓ",
        body: data.body,
      })
      .select("id, sender_type, sender_name, body, created_at")
      .single();
    if (error) throw error;
    await (supabaseAdmin as any)
      .from("chat_conversations")
      .update({ last_message_at: new Date().toISOString(), status: "aberta" })
      .eq("id", data.conversationId);
    return message;
  });

export const closeChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => adminConversationSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertTeam(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("chat_conversations")
      .update({ status: "fechada" })
      .eq("id", data.conversationId);
    if (error) throw error;
    return { ok: true as const };
  });

export function createVisitorToken() {
  return randomUUID() + randomUUID();
}
