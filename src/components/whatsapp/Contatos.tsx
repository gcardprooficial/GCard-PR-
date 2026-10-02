/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Tabelas novas ainda não estão nos tipos gerados do Supabase.
const db = supabase as any;

export type Contact = {
  id: string;
  phone_key: string;
  wa_id: string | null;
  name: string | null;
  email: string | null;
  auto_labels: string[];
  labels: string[];
  paid_orders: number;
  paid_total_cents: number;
  last_paid_at: string | null;
  pending_orders: number;
  last_order_at: string | null;
  source: string;
};

/** Mesma chave do banco: DDD + últimos 8 dígitos (tolera o 9º dígito). */
export const contactKey = (waId: string) => (waId.length >= 12 ? waId.slice(2, 4) + waId.slice(-8) : waId);

const LABEL_STYLE: Record<string, string> = {
  Cliente: "bg-g-green/20 text-g-green",
  "Cliente recorrente": "bg-emerald-500/20 text-emerald-700",
  Revenda: "bg-blue-500/20 text-blue-700",
  "Parou no pagamento": "bg-orange-500/20 text-orange-700",
  "Aguardando pagamento": "bg-yellow-400/30 text-yellow-800",
  "Pagamento falhou": "bg-red-500/20 text-red-700",
  "Cliente inativo (90d+)": "bg-zinc-500/20 text-zinc-700",
  Lead: "bg-purple-500/20 text-purple-700",
  "Parou de responder": "bg-pink-500/20 text-pink-700",
  "Falou no WhatsApp": "bg-slate-500/15 text-slate-700",
};

export function LabelChips({ auto, manual }: { auto: string[]; manual: string[] }) {
  if (!auto.length && !manual.length) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {auto.map((l) => (
        <span key={l} className={`rounded-md px-1.5 py-0.5 text-[10px] font-black ${LABEL_STYLE[l] ?? "bg-muted"}`}>
          {l}
        </span>
      ))}
      {manual.map((l) => (
        <span key={`m-${l}`} className="rounded-md border border-primary/60 px-1.5 py-0.5 text-[10px] font-black">
          {l}
        </span>
      ))}
    </span>
  );
}

export function useContacts() {
  const [rows, setRows] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await db.from("wa_contacts").select("*").order("updated_at", { ascending: false }).limit(2000);
    setRows((data ?? []) as Contact[]);
    setLoading(false);
  }, []);
  useEffect(() => void load(), [load]);

  const byKey = useMemo(() => new Map(rows.map((c) => [c.phone_key, c])), [rows]);
  return { rows, byKey, loading, reload: load };
}

const fmtPhone = (w: string | null) =>
  !w ? "" : w.startsWith("55") && w.length >= 12 ? `+55 ${w.slice(2, 4)} ${w.slice(4)}` : `+${w}`;
const money = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");

export function Contatos() {
  const { rows, loading, reload } = useContacts();
  const [filter, setFilter] = useState<string>("todos");
  const [q, setQ] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [newLabel, setNewLabel] = useState<Record<string, string>>({});

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of rows) for (const l of [...c.auto_labels, ...c.labels]) m.set(l, (m.get(l) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((c) => {
      if (filter !== "todos" && ![...c.auto_labels, ...c.labels].includes(filter)) return false;
      if (!t) return true;
      return [c.name, c.email, c.wa_id].some((v) => v?.toLowerCase().includes(t));
    });
  }, [rows, filter, q]);

  async function sync() {
    setSyncing(true);
    try {
      const { data, error } = await db.rpc("wa_sync_contacts");
      if (error) throw error;
      toast.success(`Sincronizado: ${data} contatos.`);
      await reload();
    } catch (e) {
      toast.error((e as { message?: string }).message ?? "Não consegui sincronizar.");
    } finally {
      setSyncing(false);
    }
  }

  async function setManual(c: Contact, labels: string[]) {
    const { error } = await db.from("wa_contacts").update({ labels }).eq("id", c.id);
    if (error) toast.error(error.message);
    else await reload();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Etiquetas <strong>automáticas</strong> (coloridas) saem dos pedidos do site e das conversas: quem comprou, quem
        parou no pagamento, quem sumiu. As etiquetas com <strong>contorno</strong> são suas (manuais) e nunca são
        apagadas. Atualiza sozinho todo dia e quando alguém novo chama.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={sync} disabled={syncing}>
          {syncing ? "Sincronizando…" : "↻ Sincronizar com pedidos do site"}
        </Button>
        <Input
          className="h-10 max-w-xs"
          placeholder="Buscar nome, e-mail ou número"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <span className="text-xs text-muted-foreground">{shown.length} de {rows.length}</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setFilter("todos")}
          className={`rounded-lg px-2.5 py-1 text-xs font-bold ${filter === "todos" ? "bg-foreground text-white" : "bg-muted text-muted-foreground"}`}
        >
          Todos ({rows.length})
        </button>
        {counts.map(([l, n]) => (
          <button
            key={l}
            type="button"
            onClick={() => setFilter(l)}
            className={`rounded-lg px-2.5 py-1 text-xs font-bold ${filter === l ? "bg-foreground text-white" : "bg-muted text-muted-foreground"}`}
          >
            {l} ({n})
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {!loading && rows.length === 0 && (
        <p className="rounded-2xl bg-card p-4 text-sm card-soft">
          Nenhum contato ainda. Clique em <strong>Sincronizar com pedidos do site</strong> (e confira se a migração
          <code> 20261002010000_whatsapp_v2_etiquetas.sql</code> foi rodada).
        </p>
      )}

      <div className="space-y-2">
        {shown.slice(0, 300).map((c) => (
          <div key={c.id} className="rounded-2xl bg-card p-4 card-soft">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-bold">{c.name ?? "Sem nome"}</p>
                {c.wa_id ? (
                  <a
                    className="text-xs text-muted-foreground underline"
                    href={`https://wa.me/${c.wa_id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {fmtPhone(c.wa_id)}
                  </a>
                ) : null}
                {c.email && <p className="truncate text-xs text-muted-foreground">{c.email}</p>}
              </div>
              <div className="text-right text-xs text-muted-foreground">
                {c.paid_orders > 0 && (
                  <p>
                    <strong className="text-foreground">{c.paid_orders}</strong> pedido(s) pago(s) · {money(c.paid_total_cents)}
                  </p>
                )}
                {c.pending_orders > 0 && <p>{c.pending_orders} pendente(s)</p>}
                <p>último pedido: {day(c.last_order_at)}</p>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <LabelChips auto={c.auto_labels} manual={[]} />
              {c.labels.map((l) => (
                <button
                  key={l}
                  type="button"
                  title="Clique pra remover"
                  className="rounded-md border border-primary/60 px-1.5 py-0.5 text-[10px] font-black hover:bg-red-500/10"
                  onClick={() => void setManual(c, c.labels.filter((x) => x !== l))}
                >
                  {l} ✕
                </button>
              ))}
              <form
                className="flex items-center gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = (newLabel[c.id] ?? "").trim();
                  if (!v || c.labels.includes(v)) return;
                  setNewLabel({ ...newLabel, [c.id]: "" });
                  void setManual(c, [...c.labels, v.slice(0, 30)]);
                }}
              >
                <Input
                  className="h-7 w-32 text-xs"
                  placeholder="+ etiqueta"
                  value={newLabel[c.id] ?? ""}
                  onChange={(e) => setNewLabel({ ...newLabel, [c.id]: e.target.value })}
                />
              </form>
            </div>
          </div>
        ))}
        {shown.length > 300 && (
          <p className="text-xs text-muted-foreground">Mostrando 300. Use a busca ou um filtro pra afunilar.</p>
        )}
      </div>
    </div>
  );
}
