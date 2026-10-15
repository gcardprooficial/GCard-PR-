import { untyped } from "@/lib/db-untyped";

/**
 * A checagem de equipe NO SERVIDOR. A tela do painel também confere user_roles, mas isso é só interface:
 * quem protege o dado é isto (e a RLS). Toda server function de admin chama assertTeam antes de qualquer leitura.
 */
export async function assertTeam(userId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await untyped(supabaseAdmin)
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "staff"]);
  if (error) throw error;
  if (!data?.length) throw new Error("Sem permissão para esta ação.");
}
