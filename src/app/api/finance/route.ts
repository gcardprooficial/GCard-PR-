import { getAuthedProfile } from "@/lib/authServer";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabaseServer";

const CATEGORIES = [
  "venda", "materia_prima", "embalagem", "impressao", "nfc_chip", "frete",
  "taxa_pagamento", "api_google", "api_claude", "api_outro", "anuncio",
  "ferramenta_software", "pro_labore", "imposto", "outro",
] as const;

async function requireAdmin(request: Request) {
  const p = await getAuthedProfile(request);
  if (!p) return { error: Response.json({ error: "não autenticado" }, { status: 401 }) };
  if (p.role !== "admin") return { error: Response.json({ error: "só admin" }, { status: 403 }) };
  return { profile: p };
}

export async function GET(request: Request) {
  if (!hasSupabaseEnv()) return Response.json({ entries: [], partners: [] });
  const { error } = await requireAdmin(request);
  if (error) return error;

  const supabase = getSupabaseAdmin()!;
  const [entriesRes, partnersRes] = await Promise.all([
    supabase.from("finance_entries").select("*").order("entry_date", { ascending: false }).limit(500),
    supabase.from("finance_partners").select("*").eq("active", true),
  ]);
  return Response.json({ entries: entriesRes.data ?? [], partners: partnersRes.data ?? [] });
}

export async function POST(request: Request) {
  if (!hasSupabaseEnv()) return Response.json({ error: "supabase não configurado" }, { status: 503 });
  const { error, profile } = await requireAdmin(request);
  if (error) return error;

  const body = await request.json().catch(() => ({}));
  const kind = body.kind === "in" ? "in" : body.kind === "out" ? "out" : null;
  const category = CATEGORIES.includes(body.category) ? body.category : null;
  const amount = Number(body.amount);
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 500) : "";

  if (!kind || !category || !(amount >= 0) || !description) {
    return Response.json({ error: "kind, category, amount, description obrigatórios" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin()!;
  const { data, error: insErr } = await supabase
    .from("finance_entries")
    .insert({
      kind,
      category,
      amount,
      description,
      entry_date: typeof body.entryDate === "string" ? body.entryDate : undefined,
      is_recurring: Boolean(body.isRecurring),
      created_by: profile!.userId,
    })
    .select()
    .single();

  if (insErr) return Response.json({ error: insErr.message }, { status: 500 });
  return Response.json({ entry: data });
}

export async function DELETE(request: Request) {
  if (!hasSupabaseEnv()) return Response.json({ error: "supabase não configurado" }, { status: 503 });
  const { error } = await requireAdmin(request);
  if (error) return error;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "id obrigatório" }, { status: 400 });

  const supabase = getSupabaseAdmin()!;
  const { error: delErr } = await supabase.from("finance_entries").delete().eq("id", id);
  if (delErr) return Response.json({ error: delErr.message }, { status: 500 });
  return Response.json({ ok: true });
}
