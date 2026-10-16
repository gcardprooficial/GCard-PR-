import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  decideReleaseRequest,
  listDestinationHistory,
  listReleaseRequests,
  type HistoryRow,
  type ReleaseRequest,
} from "@/lib/destination.functions";

export const Route = createFileRoute("/painel/liberacoes")({ component: Releases });

const brDateTime = (s: string) => new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
const STATUS: Record<ReleaseRequest["status"], string> = {
  pendente: "Pendente",
  aprovado_dominio: "Site liberado",
  aprovado_endereco: "Endereço liberado",
  negado: "Negado",
};

function Releases() {
  const [tab, setTab] = useState<"pedidos" | "historico">("pedidos");
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Destinos dos códigos</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Liberações</h1>
      <div className="my-4 flex gap-2">
        <Button size="sm" variant={tab === "pedidos" ? "default" : "outline"} onClick={() => setTab("pedidos")}>Pedidos de liberação</Button>
        <Button size="sm" variant={tab === "historico" ? "default" : "outline"} onClick={() => setTab("historico")}>Histórico por código</Button>
      </div>
      {tab === "pedidos" ? <Requests /> : <History />}
    </div>
  );
}

function Requests() {
  const list = useServerFn(listReleaseRequests);
  const decide = useServerFn(decideReleaseRequest);
  const [rows, setRows] = useState<ReleaseRequest[] | null>(null);
  const [sub, setSub] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await list());
    } catch {
      toast.error("Não consegui carregar os pedidos.");
      setRows([]);
    }
  }, [list]);
  useEffect(() => void load(), [load]);

  async function act(r: ReleaseRequest, decision: "dominio" | "endereco" | "negar") {
    if (decision === "dominio" && !confirm(`Liberar o site ${r.host} para TODOS os códigos${sub[r.id] ? " (com subdomínios)" : ""}?`)) return;
    setBusy(r.id);
    try {
      await decide({ data: { id: r.id, decision, includeSubdomains: Boolean(sub[r.id]) } });
      toast.success(decision === "negar" ? "Pedido negado." : "Liberado.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui salvar.");
    } finally {
      setBusy(null);
    }
  }

  const pending = (rows ?? []).filter((r) => r.status === "pendente");
  const done = (rows ?? []).filter((r) => r.status !== "pendente");

  return (
    <div>
      <h2 className="mb-2 text-lg font-semibold">Pendentes ({pending.length})</h2>
      {rows === null && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {rows && pending.length === 0 && <p className="text-sm text-muted-foreground">Nenhum pedido pendente.</p>}
      <div className="space-y-3">
        {pending.map((r) => (
          <div key={r.id} className="rounded-xl border border-border bg-card p-4 text-sm">
            <p>
              <span className="font-mono font-bold">{r.short_code}</span> · {r.requester_email} · {brDateTime(r.created_at)}
            </p>
            <p className="mt-1 break-all">
              <a href={r.url} target="_blank" rel="noopener noreferrer nofollow" className="text-primary underline">{r.url}</a>
            </p>
            <p className="mt-1 text-muted-foreground">Site: <strong>{r.host}</strong>. Abra o link e confira antes de aprovar.</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button size="sm" disabled={busy === r.id} onClick={() => act(r, "dominio")}>Liberar o site inteiro</Button>
              <label className="flex items-center gap-1 text-xs">
                <input type="checkbox" checked={Boolean(sub[r.id])} onChange={(e) => setSub({ ...sub, [r.id]: e.target.checked })} /> com subdomínios
              </label>
              <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => act(r, "endereco")}>Liberar só este endereço</Button>
              <Button size="sm" variant="ghost" disabled={busy === r.id} onClick={() => act(r, "negar")}>Negar</Button>
            </div>
          </div>
        ))}
      </div>
      {done.length > 0 && (
        <>
          <h2 className="mb-2 mt-8 text-lg font-semibold">Decididos</h2>
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
                <tr><th className="p-3">Código</th><th className="p-3">Quem pediu</th><th className="p-3">Endereço</th><th className="p-3">Decisão</th><th className="p-3">Quando</th></tr>
              </thead>
              <tbody>
                {done.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="p-3 font-mono text-xs">{r.short_code}</td>
                    <td className="p-3 break-all">{r.requester_email}</td>
                    <td className="p-3 break-all">{r.url}</td>
                    <td className="p-3">{STATUS[r.status]}</td>
                    <td className="p-3">{r.decided_at ? brDateTime(r.decided_at) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function History() {
  const run = useServerFn(listDestinationHistory);
  const [code, setCode] = useState("");
  const [rows, setRows] = useState<HistoryRow[] | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await run({ data: { code: code.trim() || undefined } }));
    } catch {
      toast.error("Não consegui carregar o histórico.");
      setRows([]);
    }
  }, [run, code]);
  useEffect(() => {
    const t = setTimeout(() => void load(), 300);
    return () => clearTimeout(t);
  }, [load]);

  const who = (r: HistoryRow) => `${r.changed_by_email ?? (r.changed_by_role === "sistema" ? "sistema" : "—")} (${r.changed_by_role})`;

  return (
    <div>
      <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Código, ex.: GCARD-00252" className="mb-3 h-9 w-64" />
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr><th className="p-3">Quando</th><th className="p-3">Código</th><th className="p-3">Destino antigo</th><th className="p-3">Destino novo</th><th className="p-3">Quem alterou</th></tr>
          </thead>
          <tbody>
            {rows === null && <tr><td className="p-4 text-muted-foreground" colSpan={5}>Carregando…</td></tr>}
            {rows?.length === 0 && <tr><td className="p-4 text-muted-foreground" colSpan={5}>Nenhuma alteração registrada ainda. O histórico começa a valer a partir da migração.</td></tr>}
            {rows?.map((r) => (
              <tr key={r.id} className="border-t border-border align-top">
                <td className="p-3 whitespace-nowrap">{brDateTime(r.changed_at)}</td>
                <td className="p-3 font-mono text-xs">{r.short_code}</td>
                <td className="p-3 break-all">{r.old_url ?? "—"}</td>
                <td className="p-3 break-all">{r.new_url ?? "(removido)"}</td>
                <td className="p-3 break-all">{who(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
