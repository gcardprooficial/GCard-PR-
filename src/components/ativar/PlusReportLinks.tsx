import { useCallback, useEffect, useState } from "react";
import { Copy, ExternalLink, Link2, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { untyped } from "@/lib/db-untyped";
import { Button } from "@/components/ui/button";

type L = { id: string; token: string; label: string | null; created_at: string; revoked_at: string | null };

/** Plus: link privado de acompanhamento (e PDF) para o cliente do assinante. Só números agregados deste código. */
export function PlusReportLinks({ plateId }: { plateId: string }) {
  const [links, setLinks] = useState<L[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await untyped(supabase)
      .from("plate_report_links")
      .select("id, token, label, created_at, revoked_at")
      .eq("plate_id", plateId)
      .order("created_at", { ascending: false });
    setLinks((data ?? []) as L[]);
  }, [plateId]);
  useEffect(() => {
    void load();
  }, [load]);

  const url = (t: string) => `${window.location.origin}/relatorio/${t}`;

  async function create() {
    const label = window.prompt("Para quem é este link? (opcional, só você vê)", "");
    if (label === null) return;
    setBusy(true);
    const { error } = await untyped(supabase).from("plate_report_links").insert({ plate_id: plateId, label: label.trim() || null });
    setBusy(false);
    if (error) return void toast.error(error.message);
    toast.success("Link criado.");
    void load();
  }
  async function revoke(l: L) {
    if (!window.confirm("Desativar este link? Quem o recebeu deixa de ver o relatório.")) return;
    const { error } = await untyped(supabase).from("plate_report_links").update({ revoked_at: new Date().toISOString() }).eq("id", l.id);
    if (error) return void toast.error(error.message);
    void load();
  }
  const active = (links ?? []).filter((l) => !l.revoked_at);

  return (
    <section className="rounded-2xl border border-border bg-card p-5 card-soft">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 font-display text-lg font-bold"><Link2 className="size-5 text-primary" /> Relatório para o cliente</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">Mande um link para quem usa este código acompanhar as leituras, ou salve em PDF. Mostra só números agregados: sem destino e sem dados de pessoas.</p>
        </div>
        <Button size="sm" className="gap-1.5 rounded-xl" disabled={busy} onClick={() => void create()}><Plus className="size-4" /> Criar link</Button>
      </div>
      {active.length > 0 && (
        <ul className="mt-3 space-y-2">
          {active.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border p-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{l.label || "Link sem nome"}</p>
                <p className="text-xs text-muted-foreground">criado em {new Date(l.created_at).toLocaleDateString("pt-BR")}</p>
              </div>
              <Button size="sm" variant="outline" className="gap-1.5 rounded-lg" onClick={() => { void navigator.clipboard.writeText(url(l.token)); toast.success("Link copiado."); }}><Copy className="size-3.5" /> Copiar</Button>
              <Button size="sm" variant="outline" className="gap-1.5 rounded-lg" asChild><a href={url(l.token)} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-3.5" /> Abrir / PDF</a></Button>
              <Button size="sm" variant="ghost" className="rounded-lg text-xs text-destructive hover:bg-destructive/10" onClick={() => void revoke(l)}>Desativar</Button>
            </li>
          ))}
        </ul>
      )}
      {links && active.length === 0 && <p className="mt-3 text-sm text-muted-foreground">Nenhum link ainda.</p>}
      <p className="mt-3 text-[11px] text-muted-foreground">Se o seu Plus ficar inativo, os links ficam indisponíveis até você reativar.</p>
    </section>
  );
}
