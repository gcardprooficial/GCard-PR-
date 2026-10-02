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

export const sendWhatsAppOriginSurvey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ conversationId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertTeam(context.userId);
    const { sendOriginSurvey } = await import("./bot.server");
    return { sent: await sendOriginSurvey(data.conversationId) };
  });

export const getWhatsAppStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertTeam(context.userId);
    const { provider } = await import("./transport.server");
    const p = provider();
    const env = process.env;
    return {
      provider: p,
      connected:
        p === "zapi"
          ? Boolean(env["ZAPI_WEBHOOK_SECRET"])
          : Boolean(env["WHATSAPP_TOKEN"] && env["WHATSAPP_PHONE_NUMBER_ID"] && env["WHATSAPP_APP_SECRET"] && env["WHATSAPP_VERIFY_TOKEN"]),
      ai: Boolean(env["ANTHROPIC_API_KEY"] || env["GEMINI_API_KEY"]),
    };
  });
