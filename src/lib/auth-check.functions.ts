import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { untyped } from "@/lib/db-untyped";

/**
 * Antes de criar a conta: já existe OUTRA conta com e-mail quase igual (gmail ignora ponto e +etiqueta)?
 * Só responde sim/não (sem dizer qual e-mail), com limite de requisições, para não virar lista de e-mails.
 */
export const checkSignupEmail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ email: z.string().trim().email().max(254) }).parse(input))
  .handler(async ({ data }) => {
    if (!rateLimit(`signup-check:${clientKey(getRequest())}`, 10, 600_000)) return { similar: false as const, limited: true as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: similar, error } = await untyped(supabaseAdmin).rpc("similar_account_exists", { _email: data.email });
    if (error) {
      console.error("similar_account_exists falhou", error);
      return { similar: false as const, limited: false as const }; // na dúvida, não bloqueia o cadastro
    }
    return { similar: Boolean(similar), limited: false as const };
  });
