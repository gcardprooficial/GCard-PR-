import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

export const sendWhatsAppText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ conversationId: z.string().uuid(), text: z.string().trim().min(1).max(4000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertTeam(context.userId);
    const { sendHumanMessage } = await import("./bot.server");
    await sendHumanMessage(data.conversationId, data.text);
    return { ok: true as const };
  });

export const sendWhatsAppQuickReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ conversationId: z.string().uuid(), quickReplyId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertTeam(context.userId);
    const { sendQuickReply } = await import("./bot.server");
    await sendQuickReply(data.conversationId, data.quickReplyId);
    return { ok: true as const };
  });

export const getWhatsAppStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertTeam(context.userId);
    return {
      whatsapp: Boolean(process.env["WHATSAPP_TOKEN"] && process.env["WHATSAPP_PHONE_NUMBER_ID"]),
      webhookSecret: Boolean(process.env["WHATSAPP_APP_SECRET"] && process.env["WHATSAPP_VERIFY_TOKEN"]),
      ai: Boolean(process.env["ANTHROPIC_API_KEY"]),
    };
  });
