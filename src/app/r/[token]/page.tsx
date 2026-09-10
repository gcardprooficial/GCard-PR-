import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, Nfc, Star } from "lucide-react";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabaseServer";
import { isSafePlateDestination } from "@/lib/plate/redirect";

export const metadata: Metadata = { robots: { index: false } };
export const dynamic = "force-dynamic";

// Rota pública dinâmica da placa. O QR impresso e o chip NFC carregam
// /r/{public_token}. Resolve -> registra scan -> redireciona (ativada) ou
// mostra tela de ativação / tela segura.
export default async function PlateRedirectPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!hasSupabaseEnv() || !/^[A-Z0-9]{8,40}$/.test(token)) {
    return <Shell><NotFound /></Shell>;
  }

  const supabase = getSupabaseAdmin()!;
  const { data: unit } = await supabase
    .from("plate_units")
    .select("id, status")
    .eq("public_token", token)
    .maybeSingle();

  if (!unit) return <Shell><NotFound /></Shell>;

  await supabase
    .from("plate_scan_events")
    .insert({ unit_id: unit.id, event_type: unit.status === "activated" ? "redirect" : "activation_page_view" })
    .then(undefined, () => {});

  if (unit.status === "activated") {
    const { data: dest } = await supabase
      .from("plate_destinations")
      .select("destination_url")
      .eq("unit_id", unit.id)
      .eq("is_active", true)
      .maybeSingle();

    if (dest?.destination_url && isSafePlateDestination(dest.destination_url)) {
      redirect(dest.destination_url);
    }
    return <Shell><ErrorState msg="O destino desta placa ainda não foi configurado. Fale com quem te entregou a placa." /></Shell>;
  }

  if (["available_for_activation", "shipped", "in_stock", "manufacturing"].includes(unit.status)) {
    return <Shell><NotActivated token={token} /></Shell>;
  }

  return <Shell><ErrorState msg="Esta placa está temporariamente indisponível." /></Shell>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-5 py-16 text-[var(--color-ink)]">
      <div className="w-full max-w-sm rounded-3xl border border-[var(--color-border)] bg-white p-8 text-center shadow-lg">{children}</div>
    </main>
  );
}

function NotActivated({ token }: { token: string }) {
  return (
    <>
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-accent)]/10 text-[var(--color-accent)]"><Nfc className="h-7 w-7" /></div>
      <h1 className="mt-5 text-2xl font-black">Esta placa ainda não foi ativada</h1>
      <p className="mt-2 text-sm text-[var(--color-muted)]">Se você é revendedor, ative esta placa e ligue ela ao negócio do seu cliente.</p>
      <Link href={`/painel/ativar?token=${encodeURIComponent(token)}`} className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-[var(--color-accent)] px-5 py-3.5 font-black text-white">Ativar placa</Link>
    </>
  );
}

function ErrorState({ msg }: { msg: string }) {
  return (
    <>
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"><AlertTriangle className="h-7 w-7" /></div>
      <h1 className="mt-5 text-xl font-black">Ops</h1>
      <p className="mt-2 text-sm text-[var(--color-muted)]">{msg}</p>
    </>
  );
}

function NotFound() {
  return (
    <>
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-surface)] text-[var(--color-muted)]"><Star className="h-7 w-7" /></div>
      <h1 className="mt-5 text-xl font-black">Placa não encontrada</h1>
      <p className="mt-2 text-sm text-[var(--color-muted)]">Confira o código ou fale com quem te entregou a placa.</p>
    </>
  );
}
