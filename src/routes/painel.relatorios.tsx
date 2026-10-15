import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DomainExpiryBanner } from "@/components/DomainExpiryBanner";
import {
  exportAccountsCsv,
  getAccountsReport,
  getFunnelReport,
  setInternalAccount,
  type AccountRow,
  type FunnelRow,
} from "@/lib/reports.functions";

export const Route = createFileRoute("/painel/relatorios")({ component: Reports });

const iso = (d: Date) => d.toISOString().slice(0, 10);
const brDate = (s: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR") : "—");
const ENG = { quente: "Quente", morno: "Morno", nao_confirmado: "Não confirmou" } as const;
const ENG_STYLE = {
  quente: "bg-emerald-100 text-emerald-900",
  morno: "bg-amber-100 text-amber-900",
  nao_confirmado: "bg-slate-100 text-slate-700",
} as const;

function Reports() {
  const [tab, setTab] = useState<"funil" | "contas">("funil");
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Relatórios</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Funil e contas</h1>
      <div className="mt-4">
        <DomainExpiryBanner editable />
      </div>
      <div className="mb-5 flex gap-2">
        {(["funil", "contas"] as const).map((t) => (
          <Button key={t} size="sm" variant={tab === t ? "default" : "outline"} onClick={() => setTab(t)}>
            {t === "funil" ? "Funil por origem" : "Contas sem compra"}
          </Button>
        ))}
      </div>
      {tab === "funil" ? <Funnel /> : <Accounts />}
    </div>
  );
}

function Funnel() {
  const run = useServerFn(getFunnelReport);
  const [from, setFrom] = useState(() => iso(new Date(Date.now() - 30 * 86_400_000)));
  const [to, setTo] = useState(() => iso(new Date()));
  const [internal, setInternal] = useState(false);
  const [rows, setRows] = useState<FunnelRow[] | null>(null);

  const load = useCallback(async () => {
    setRows(null);
    try {
      setRows(await run({ data: { from, to, includeInternal: internal } }));
    } catch {
      toast.error("Não consegui carregar o funil.");
      setRows([]);
    }
  }, [run, from, to, internal]);
  useEffect(() => void load(), [load]);

  const total = (k: keyof Omit<FunnelRow, "source">) => (rows ?? []).reduce((s, r) => s + Number(r[k]), 0);
  const cols: [string, keyof Omit<FunnelRow, "source">][] = [
    ["Viu produto", "viu_produto"],
    ["Contas", "contas"],
    ["Confirmaram", "confirmados"],
    ["Checkout", "checkouts"],
    ["Pagto iniciado", "pagamentos_iniciados"],
    ["Pagos", "pagos"],
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">De <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1" /></label>
        <label className="flex items-center gap-2">até <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1" /></label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} /> Incluir contas internas/teste</label>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Origem</th>
              {cols.map(([label]) => <th key={label} className="p-3 text-right">{label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows === null && <tr><td className="p-4 text-muted-foreground" colSpan={7}>Carregando…</td></tr>}
            {rows?.length === 0 && <tr><td className="p-4 text-muted-foreground" colSpan={7}>Sem eventos no período.</td></tr>}
            {rows?.map((r) => (
              <tr key={r.source} className="border-t border-border">
                <td className="p-3 font-semibold">{r.source}</td>
                {cols.map(([label, k]) => <td key={label} className="p-3 text-right tabular-nums">{Number(r[k])}</td>)}
              </tr>
            ))}
            {rows && rows.length > 0 && (
              <tr className="border-t-2 border-border bg-muted/50 font-bold">
                <td className="p-3">Total</td>
                {cols.map(([label, k]) => <td key={label} className="p-3 text-right tabular-nums">{total(k)}</td>)}
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Contagem de eventos no período. "Origem" = primeira visita do cliente (utm_source ou site de origem; vazio = direto).</p>
    </div>
  );
}

function Accounts() {
  const run = useServerFn(getAccountsReport);
  const exportCsv = useServerFn(exportAccountsCsv);
  const mark = useServerFn(setInternalAccount);
  const [onlyNoBuy, setOnlyNoBuy] = useState(true);
  const [internal, setInternal] = useState(false);
  const [eng, setEng] = useState<"todos" | AccountRow["engagement"]>("todos");
  const [rows, setRows] = useState<AccountRow[] | null>(null);

  const load = useCallback(async () => {
    setRows(null);
    try {
      setRows(await run({ data: { onlyWithoutPurchase: onlyNoBuy, includeInternal: internal } }));
    } catch {
      toast.error("Não consegui carregar as contas.");
      setRows([]);
    }
  }, [run, onlyNoBuy, internal]);
  useEffect(() => void load(), [load]);

  const shown = (rows ?? []).filter((r) => eng === "todos" || r.engagement === eng);
  const count = (e: AccountRow["engagement"]) => (rows ?? []).filter((r) => r.engagement === e).length;

  async function download(mode: "operacional" | "marketing") {
    try {
      const r = await exportCsv({ data: { mode, onlyWithoutPurchase: onlyNoBuy } });
      if (r.count === 0) {
        toast.error("Nada para exportar.");
        return;
      }
      const url = URL.createObjectURL(new Blob([r.csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = r.filename;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`${r.count} linha(s) exportada(s).`);
    } catch {
      toast.error("Não consegui exportar.");
    }
  }

  async function toggleInternal(a: AccountRow) {
    try {
      await mark({ data: { email: a.email, internal: !a.is_internal } });
      toast.success(a.is_internal ? "Desmarcada." : "Marcada como interna/teste.");
      load();
    } catch {
      toast.error("Não consegui salvar.");
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={onlyNoBuy} onChange={(e) => setOnlyNoBuy(e.target.checked)} /> Só quem nunca pagou</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} /> Incluir internas/teste</label>
        {(["todos", "quente", "morno", "nao_confirmado"] as const).map((e) => (
          <Button key={e} size="sm" variant={eng === e ? "default" : "outline"} onClick={() => setEng(e)}>
            {e === "todos" ? `Todos (${rows?.length ?? 0})` : `${ENG[e]} (${count(e)})`}
          </Button>
        ))}
        <span className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={() => download("operacional")}>CSV operacional</Button>
          <Button size="sm" variant="outline" onClick={() => download("marketing")}>CSV marketing (só com aceite)</Button>
        </span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">E-mail</th><th className="p-3">Origem</th><th className="p-3">Criada</th>
              <th className="p-3">Último acesso</th><th className="p-3">Engajamento</th><th className="p-3">Aceite</th><th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {rows === null && <tr><td className="p-4 text-muted-foreground" colSpan={7}>Carregando…</td></tr>}
            {rows && shown.length === 0 && <tr><td className="p-4 text-muted-foreground" colSpan={7}>Nenhuma conta.</td></tr>}
            {shown.map((a) => (
              <tr key={a.user_id} className="border-t border-border">
                <td className="p-3 break-all">{a.email}{a.is_internal && <span className="ml-2 rounded bg-slate-200 px-1.5 text-xs">interna</span>}</td>
                <td className="p-3">{a.source}</td>
                <td className="p-3">{brDate(a.created_at)}</td>
                <td className="p-3">{brDate(a.last_sign_in_at)}</td>
                <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ENG_STYLE[a.engagement]}`}>{ENG[a.engagement]}</span></td>
                <td className="p-3">{a.consented ? "Sim" : "Não"}</td>
                <td className="p-3 text-right"><Button size="sm" variant="ghost" onClick={() => toggleInternal(a)}>{a.is_internal ? "Desmarcar" : "Marcar interna"}</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Quente = confirmou o e-mail e voltou depois do cadastro. Morno = confirmou e não voltou. Contas com "+teste" no e-mail, da equipe ou marcadas à mão ficam de fora.</p>
    </div>
  );
}
