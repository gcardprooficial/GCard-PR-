import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { untyped } from "@/lib/db-untyped";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/painel/denuncias")({ component: Denuncias });

type Report = {
  id: string;
  plate_id: string | null;
  short_code: string;
  reason: string;
  details: string | null;
  contact: string | null;
  status: "aberta" | "resolvida" | "descartada";
  created_at: string;
};

const REASON: Record<string, string> = { golpe: "Golpe ou fraude", conteudo_ilegal: "Conteúdo ilegal", outro: "Outro" };

/** Denúncias de abuso: a equipe analisa e pode desativar o código (status "bloqueada"). Só a RLS da equipe lê. */
function Denuncias() {
  const db = untyped(supabase);
  const [rows, setRows] = useState<Report[] | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await db.from("abuse_reports").select("*").order("created_at", { ascending: false }).limit(200);
    if (error) {
      toast.error("Não consegui carregar as denúncias.");
      return;
    }
    setRows((data ?? []) as Report[]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function close(r: Report, status: "resolvida" | "descartada") {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await db
      .from("abuse_reports")
      .update({ status, resolved_at: new Date().toISOString(), resolved_by: u.user?.id ?? null })
      .eq("id", r.id);
    if (error) return toast.error(error.message);
    void load();
  }

  async function block(r: Report) {
    if (!r.plate_id) return toast.error("Código não encontrado.");
    if (!window.confirm(`Desativar o código ${r.short_code}? Ele deixa de redirecionar.`)) return;
    const { error } = await db
      .from("plates")
      .update({ status: "bloqueada", block_reason: `Denúncia: ${REASON[r.reason] ?? r.reason}` })
      .eq("id", r.plate_id);
    if (error) return toast.error(error.message);
    toast.success(`${r.short_code} desativado.`);
    await close(r, "resolvida");
  }

  async function unblock(r: Report) {
    if (!r.plate_id) return;
    const { error } = await db.from("plates").update({ status: "nao_ativada" }).eq("id", r.plate_id);
    if (error) return toast.error(error.message);
    toast.success(`${r.short_code} reativado (volta como não ativado).`);
  }

  if (!rows) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  const open = rows.filter((r) => r.status === "aberta");

  return (
    <>
      <h1 className="text-2xl">Denúncias de código</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {open.length} aberta(s). "Desativar" bloqueia o código: ele passa a mostrar uma página neutra em vez de redirecionar.
      </p>
      <div className="mt-4 space-y-3">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma denúncia.</p>}
        {rows.map((r) => (
          <div key={r.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono font-black">{r.short_code}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(r.created_at).toLocaleString("pt-BR")} · {r.status}
              </span>
            </div>
            <p className="mt-1 text-sm font-semibold">{REASON[r.reason] ?? r.reason}</p>
            {r.details && <p className="mt-1 text-sm text-muted-foreground">{r.details}</p>}
            {r.contact && <p className="mt-1 text-xs text-muted-foreground">Contato: {r.contact}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {r.status === "aberta" && (
                <>
                  <Button size="sm" variant="destructive" onClick={() => void block(r)}>Desativar código</Button>
                  <Button size="sm" variant="outline" onClick={() => void close(r, "descartada")}>Descartar</Button>
                </>
              )}
              {r.status === "resolvida" && (
                <Button size="sm" variant="outline" onClick={() => void unblock(r)}>Reativar código</Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
