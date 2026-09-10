import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabaseServer";

export type AuthedProfile = { userId: string; role: "admin" | "staff" | "customer" };

// Valida o Bearer token da request e devolve o profile (id + role).
// null = sem token válido. As rotas decidem se exigem admin.
export async function getAuthedProfile(request: Request): Promise<AuthedProfile | null> {
  if (!hasSupabaseEnv()) return null;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anon) return null;

  const { data, error } = await createClient(url, anon).auth.getUser(token);
  if (error || !data.user) return null;

  const admin = getSupabaseAdmin()!;
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();

  return { userId: data.user.id, role: (profile?.role as AuthedProfile["role"]) ?? "customer" };
}
