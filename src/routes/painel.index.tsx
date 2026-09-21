import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { money } from "@/lib/pricing";
import {
  reconcileOrdersNow,
  saveOrderTracking,
  sendOrderEmail,
  sendPaymentLinkEmail,
} from "@/lib/panel.functions";
import { createCheckoutPreference } from "@/lib/payments/createPreference.server";
import { usePanel } from "@/lib/panelContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/painel/")({
  validateSearch: (search: Record<string, unknown>): { q?: string } =>
    typeof search["q"] === "string" ? { q: search["q"] } : {},
  component: Orders,
});

const FULFILLMENT = ["recebido", "em_producao", "enviado", "entregue", "cancelado"] as const;
const FULFILLMENT_LABEL: Record<string, string> = {
  recebido: "Recebido",
  em_producao: "Em produção",
  enviado: "Enviado",
  entregue: "Entregue",
  cancelado: "Cancelado",
};
const PAYMENT_LABEL: Record<string, string> = {
  pendente: "Pendente",
  pago: "Pago",
  recusado: "Recusado",
  estornado: "Estornado",
  cancelado: "Cancelado",
};

function formatCpf(doc: string | null): string {
  const digits = (doc ?? "").replace(/\D/g, "");
  if (digits.length !== 11) return doc || "—";
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function formatCep(zip: string): string {
  const digits = zip.replace(/\D/g, "");
  if (digits.length !== 8) return zip;
  return digits.replace(/(\d{5})(\d{3})/, "$1-$2");
}

type OrderRow = {
  id: string;
  order_number: number;
  created_at: string;
  kind: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  customer_document: string | null;
  quantity: number;
  total_cents: number;
  payment_status: string;
  payment_provider: string | null;
  fulfillment_status: string;
  tracking_code: string | null;
  ship_street: string | null;
  ship_number: string | null;
  ship_district: string | null;
  ship_city: string | null;
  ship_state: string | null;
  ship_zip: string | null;
  internal_notes: string | null;
  businesses: { name: string; review_url: string } | null;
  order_items: {
    product_name: string;
    quantity: number;
    products: { image_url: string | null; is_blank: boolean } | null;
  }[];
};

// Etapa do pedido no funil -- cada aba do painel é uma etapa, pra não misturar
// "não pagou" com "falta produzir".
type Stage = "aguardando" | "a_produzir" | "em_producao" | "enviados" | "concluidos";
const STAGES: { key: Stage; label: string }[] = [
  { key: "aguardando", label: "Aguardando pagamento" },
  { key: "a_produzir", label: "Pagos · a produzir" },
  { key: "em_producao", label: "Em produção" },
  { key: "enviados", label: "Enviados" },
  { key: "concluidos", label: "Entregues / cancelados" },
];

function stageOf(r: { payment_status: string; fulfillment_status: string }): Stage {
  if (r.fulfillment_status === "cancelado") return "concluidos";
  if (r.payment_status === "estornado" || r.payment_status === "cancelado") return "concluidos";
  if (r.payment_status !== "pago") return "aguardando";
  if (r.fulfillment_status === "entregue") return "concluidos";
  if (r.fulfillment_status === "enviado") return "enviados";
  if (r.fulfillment_status === "em_producao") return "em_producao";
  return "a_produzir";
}

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `há ${hours} h`;
  return `há ${Math.round(hours / 24)} dias`;
}

/** Por que um pedido ainda não foi pago: erro nosso (sem link) ou o cliente só não pagou. */
function unpaidReason(r: OrderRow): { text: string; tone: "red" | "amber" } {
  if (r.payment_status === "recusado") {
    return { text: "Pagamento recusado no Mercado Pago", tone: "red" };
  }
  if (!r.payment_provider) {
    return { text: "Sem link registrado — use 'Gerar e copiar link' e mande pro cliente", tone: "red" };
  }
  return { text: "Link gerado — cliente ainda não pagou", tone: "amber" };
}

type BatchByOrder = { orderId: string; code: string; codes_sent_at: string | null };
type AuditRow = {
  id: string;
  action: string;
  actor_email: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

/** Aceita links /r/<token>, tokens de 32 hex e os códigos curtos GCARD-00001 escritos nas placas. */
function parseScanned(text: string) {
  const hex = new Set((text.match(/[0-9a-f]{32}/gi) ?? []).map((t) => t.toLowerCase()));
  const shorts = new Set((text.match(/GCARD-\d{5}/gi) ?? []).map((t) => t.toUpperCase()));
  return { hex, shorts };
}

function Orders() {
  const { userId, email } = usePanel();
  const search = Route.useSearch();
  const runSaveTracking = useServerFn(saveOrderTracking);
  const runSendOrderEmail = useServerFn(sendOrderEmail);
  const runSendPaymentLinkEmail = useServerFn(sendPaymentLinkEmail);
  const runCreatePreference = useServerFn(createCheckoutPreference);
  const runReconcile = useServerFn(reconcileOrdersNow);
  const [rows, setRows] = useState<OrderRow[] | null>(null);
  const [batchesByOrder, setBatchesByOrder] = useState<Record<string, BatchByOrder>>({});
  const [kindFilter, setKindFilter] = useState<"all" | "individual" | "revenda">("all");
  const [stage, setStage] = useState<Stage | "todos">("a_produzir");
  const [checkingPayments, setCheckingPayments] = useState(false);
  const [q, setQ] = useState(search.q ?? "");
  const [sendingPaymentFor, setSendingPaymentFor] = useState<string | null>(null);
  const [deletingFor, setDeletingFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, order_number, created_at, kind, customer_name, customer_email, customer_phone, customer_document, quantity, total_cents, payment_status, payment_provider, fulfillment_status, tracking_code, ship_street, ship_number, ship_district, ship_city, ship_state, ship_zip, internal_notes, businesses(name, review_url), order_items(product_name, quantity, products(image_url, is_blank))",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      toast.error("Não foi possível carregar os pedidos.");
      return;
    }
    setRows((data ?? []) as unknown as OrderRow[]);

    const { data: batches } = await supabase
      .from("batches")
      .select("owner_order_id, code, codes_sent_at")
      .not("owner_order_id", "is", null);
    const map: Record<string, BatchByOrder> = {};
    for (const b of batches ?? []) {
      if (b.owner_order_id) {
        map[b.owner_order_id] = {
          orderId: b.owner_order_id,
          code: b.code,
          codes_sent_at: b.codes_sent_at,
        };
      }
    }
    setBatchesByOrder(map);
  }, []);

  // Pergunta ao Mercado Pago o que aconteceu com os pendentes (webhook que não chegou)
  // e recarrega se algum foi baixado como pago.
  const checkPayments = useCallback(
    async (silent: boolean) => {
      setCheckingPayments(true);
      try {
        const result = await runReconcile();
        if ("settled" in result && result.settled > 0) {
          toast.success(`${result.settled} pagamento(s) confirmado(s) automaticamente.`);
          await load();
        } else if (!silent) {
          toast.message("Nenhum pagamento novo encontrado.");
        }
      } catch {
        if (!silent) toast.error("Não foi possível conferir os pagamentos agora.");
      } finally {
        setCheckingPayments(false);
      }
    },
    [load, runReconcile],
  );

  useEffect(() => {
    void load().then(() => void checkPayments(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [scanOpenFor, setScanOpenFor] = useState<string | null>(null);
  const [scanText, setScanText] = useState("");
  const [historyOpenId, setHistoryOpenId] = useState<string | null>(null);
  const [historyByOrder, setHistoryByOrder] = useState<Record<string, AuditRow[]>>({});
  const [historyLoading, setHistoryLoading] = useState(false);

  async function toggleHistory(orderId: string) {
    if (historyOpenId === orderId) {
      setHistoryOpenId(null);
      return;
    }
    setHistoryOpenId(orderId);
    if (historyByOrder[orderId]) return;
    setHistoryLoading(true);
    const { data } = await supabase
      .from("audit_log")
      .select("id, action, actor_email, details, created_at")
      .eq("entity", "orders")
      .eq("entity_id", orderId)
      .order("created_at", { ascending: false });
    setHistoryLoading(false);
    setHistoryByOrder((prev) => ({ ...prev, [orderId]: (data ?? []) as unknown as AuditRow[] }));
  }

  async function generateBatchForOrder(row: OrderRow) {
    setGeneratingFor(row.id);
    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select("product_id, quantity")
      .eq("order_id", row.id);
    const productId = items?.[0]?.product_id;
    if (itemsError || !productId) {
      setGeneratingFor(null);
      toast.error("Não encontrei o produto deste pedido.");
      return;
    }
    const { data: batchId, error } = await supabase.rpc("allocate_batch_from_stock", {
      _label: `Pedido #${row.order_number}`,
      _product_id: productId,
      _quantity: row.quantity,
      _owner_email: row.customer_email,
      _unit_cost_cents: 0,
    });
    if (error) {
      setGeneratingFor(null);
      toast.error(error.message);
      return;
    }
    await supabase
      .from("batches")
      .update({ owner_order_id: row.id })
      .eq("id", batchId as string);
    await supabase.from("audit_log").insert({
      actor_id: userId,
      actor_email: email,
      action: "allocate_batch_from_stock",
      entity: "batches",
      entity_id: String(batchId),
      details: { order_id: row.id, quantity: row.quantity },
    });
    try {
      await runSendOrderEmail({ data: { orderId: row.id, event: "lote_criado" } });
    } catch {
      // e-mail é best-effort aqui -- lote já foi gerado, não bloqueia o fluxo
    }
    setGeneratingFor(null);
    toast.success(`Lote gerado pro pedido #${row.order_number}.`);
    void load();
  }

  // Monta o lote com as placas que foram escaneadas de verdade (cole os links /r/... ou os tokens).
  async function assignScannedPlates(row: OrderRow) {
    const { hex, shorts } = parseScanned(scanText);
    if (hex.size + shorts.size !== row.quantity) {
      toast.error(`Encontrei ${hex.size + shorts.size} código(s), mas o pedido tem ${row.quantity} un.`);
      return;
    }
    setGeneratingFor(row.id);
    const tokens = new Set(hex);
    if (shorts.size > 0) {
      const { data: found, error: lookupError } = await supabase
        .from("plates")
        .select("token, short_code")
        .in("short_code", [...shorts]);
      const foundPlates = (found ?? []) as unknown as { token: string; short_code: string }[];
      const foundCodes = new Set(foundPlates.map((f) => f.short_code));
      const missing = [...shorts].filter((c) => !foundCodes.has(c));
      if (lookupError || missing.length > 0) {
        setGeneratingFor(null);
        toast.error(
          lookupError ? "Não consegui consultar as placas." : `Código(s) não encontrado(s): ${missing.join(", ")}`,
        );
        return;
      }
      for (const f of foundPlates) tokens.add(f.token);
    }
    if (tokens.size !== row.quantity) {
      setGeneratingFor(null);
      toast.error("Um mesmo código foi informado duas vezes (link e código curto da mesma placa).");
      return;
    }
    const { data: items } = await supabase
      .from("order_items")
      .select("product_id")
      .eq("order_id", row.id);
    const productId = items?.[0]?.product_id;
    if (!productId) {
      setGeneratingFor(null);
      toast.error("Não encontrei o produto deste pedido.");
      return;
    }
    const rpc = (
      supabase as unknown as {
        rpc: (
          fn: string,
          args: Record<string, unknown>,
        ) => Promise<{ data: unknown; error: { message: string } | null }>;
      }
    ).rpc;
    const { data: batchId, error } = await rpc.call(supabase, "allocate_batch_from_tokens", {
      _label: `Pedido #${row.order_number}`,
      _product_id: productId,
      _tokens: [...tokens],
      _owner_email: row.customer_email,
      _owner_order_id: row.id,
    });
    if (error) {
      setGeneratingFor(null);
      toast.error(error.message);
      return;
    }
    await supabase.from("audit_log").insert({
      actor_id: userId,
      actor_email: email,
      action: "allocate_batch_from_tokens",
      entity: "batches",
      entity_id: String(batchId),
      details: { order_id: row.id, quantity: tokens.size },
    });
    try {
      await runSendOrderEmail({ data: { orderId: row.id, event: "lote_criado" } });
    } catch (emailError) {
      console.error("Falha ao enviar e-mail lote_criado", emailError);
      toast.error("Lote montado, mas o e-mail do lote não foi enviado.");
    }
    setGeneratingFor(null);
    setScanOpenFor(null);
    setScanText("");
    toast.success(`Lote do pedido #${row.order_number} montado com ${tokens.size} placas.`);
    void load();
  }

  async function sendPaymentLink(row: OrderRow) {
    setSendingPaymentFor(row.id);
    try {
      await runSendPaymentLinkEmail({ data: { orderId: row.id } });
      toast.success(`Link de pagamento enviado para ${row.customer_email}.`);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar o e-mail.");
    } finally {
      setSendingPaymentFor(null);
    }
  }

  async function deleteOrder(row: OrderRow) {
    setDeletingFor(row.id);
    // order_items tem ON DELETE CASCADE, mas só se a policy de DELETE deixar
    // o cascade rodar sob RLS -- ver migration orders_team_delete.
    const { error } = await supabase.from("orders").delete().eq("id", row.id);
    setDeletingFor(null);
    if (error) {
      toast.error("Não foi possível excluir. " + error.message);
      return;
    }
    await supabase.from("audit_log").insert({
      actor_id: userId,
      actor_email: email,
      action: "delete_order",
      entity: "orders",
      entity_id: row.id,
      details: { order_number: row.order_number, customer_email: row.customer_email },
    });
    setRows((prev) => prev?.filter((r) => r.id !== row.id) ?? null);
    toast.success(`Pedido #${row.order_number} excluído.`);
  }

  async function patch(row: OrderRow, changes: Partial<OrderRow>) {
    const { error } = await supabase.from("orders").update(changes).eq("id", row.id);
    if (error) {
      toast.error("Não foi possível salvar.");
      return;
    }
    if (changes.payment_status === "pago" && row.payment_status !== "pago") {
      try {
        await runSendOrderEmail({ data: { orderId: row.id, event: "pagamento_confirmado" } });
      } catch (emailError) {
        // Status já foi salvo -- só o e-mail falhou. Avisa em vez de engolir.
        console.error("Falha ao enviar e-mail pagamento_confirmado", emailError);
        toast.error("Status salvo, mas o e-mail de confirmação não foi enviado.");
      }
    }
    if (changes.fulfillment_status === "em_producao" && row.fulfillment_status !== "em_producao") {
      try {
        await runSendOrderEmail({ data: { orderId: row.id, event: "em_producao" } });
      } catch (emailError) {
        console.error("Falha ao enviar e-mail em_producao", emailError);
        toast.error("Status salvo, mas o e-mail de produção não foi enviado.");
      }
    }
    if (changes.fulfillment_status === "entregue" && row.fulfillment_status !== "entregue") {
      try {
        await runSendOrderEmail({ data: { orderId: row.id, event: "pedido_entregue" } });
      } catch (emailError) {
        console.error("Falha ao enviar e-mail pedido_entregue", emailError);
        toast.error("Status salvo, mas o e-mail de entrega não foi enviado.");
      }
    }
    await supabase.from("audit_log").insert({
      actor_id: userId,
      actor_email: email,
      action: "update_order",
      entity: "orders",
      entity_id: row.id,
      details: changes as Record<string, unknown>,
    });
    setRows((prev) => prev?.map((r) => (r.id === row.id ? { ...r, ...changes } : r)) ?? null);
    toast.success(`Pedido #${row.order_number} atualizado.`);
  }

  const stageCounts: Record<Stage, number> = {
    aguardando: 0,
    a_produzir: 0,
    em_producao: 0,
    enviados: 0,
    concluidos: 0,
  };
  for (const r of rows ?? []) {
    if (kindFilter === "all" || r.kind === kindFilter) stageCounts[stageOf(r)]++;
  }
  const counts = {
    all: rows?.length ?? 0,
    individual: rows?.filter((r) => r.kind === "individual").length ?? 0,
    revenda: rows?.filter((r) => r.kind === "revenda").length ?? 0,
  };
  const visible = (rows ?? []).filter((r) => {
    if (kindFilter !== "all" && r.kind !== kindFilter) return false;
    // Buscando por nome/número: procura em todas as etapas, senão o pedido "some".
    if (!q.trim() && stage !== "todos" && stageOf(r) !== stage) return false;
    if (!q.trim()) return true;
    const t = q.toLowerCase();
    return (
      r.customer_name.toLowerCase().includes(t) ||
      r.customer_email.toLowerCase().includes(t) ||
      String(r.order_number).includes(t)
    );
  });

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl">Pedidos</h1>
        <div className="flex items-center gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar nome / e-mail / número"
            className="h-9 w-64"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={checkingPayments}
            onClick={() => void load().then(() => checkPayments(false))}
          >
            {checkingPayments ? "Conferindo…" : "Atualizar e conferir pagamentos"}
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {STAGES.map((s) => {
          const active = stage === s.key;
          const urgent = s.key === "aguardando" && stageCounts.aguardando > 0;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setStage(s.key)}
              className={`rounded-xl border px-3.5 py-2 text-sm font-semibold transition-colors ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {s.label}{" "}
              <span
                className={`ml-1 rounded-full px-1.5 py-0.5 text-xs ${
                  active
                    ? "bg-black/10"
                    : urgent
                      ? "bg-amber-100 text-amber-800"
                      : "bg-secondary"
                }`}
              >
                {stageCounts[s.key]}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setStage("todos")}
          className={`rounded-xl border px-3.5 py-2 text-sm font-semibold transition-colors ${
            stage === "todos"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-muted-foreground hover:text-foreground"
          }`}
        >
          Todos ({counts.all})
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-muted-foreground">
        <span className="self-center">Tipo:</span>
        {(
          [
            ["all", `Todos (${counts.all})`],
            ["individual", `Loja própria (${counts.individual})`],
            ["revenda", `Revenda / lote (${counts.revenda})`],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setKindFilter(k)}
            className={`rounded-full px-3 py-1 transition-colors ${
              kindFilter === k ? "bg-secondary text-foreground" : "hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {rows === null ? (
        <p className="mt-8 text-sm text-muted-foreground">Carregando…</p>
      ) : visible.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">Nenhum pedido nesta aba.</p>
      ) : (
        <div className="mt-6 space-y-4">
          {visible.map((r) => (
            <div
              key={r.id}
              className={`rounded-2xl bg-card p-5 card-soft ${
                r.kind === "individual" ? "border-l-4 border-primary" : "border-l-4 border-g-blue"
              }`}
            >
              <div
                className={`mb-3 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                  r.kind === "individual"
                    ? "bg-primary/15 text-foreground"
                    : "bg-g-blue/15 text-foreground"
                }`}
              >
                {r.order_items.some((it) => it.products?.is_blank)
                  ? "ACRÍLICO SEM ARTE — só separar cor e quantidade (sem QR/NFC, sem lote)"
                  : r.kind === "individual"
                    ? "LOJA PRÓPRIA — vai configurada com o negócio abaixo"
                    : "REVENDA — enviar em branco, sem configuração (códigos na aba Lotes)"}
              </div>
              <div className="flex flex-wrap items-start gap-4">
                {r.order_items[0]?.products?.image_url && (
                  <img
                    src={r.order_items[0].products.image_url}
                    alt={r.order_items[0].product_name}
                    className="size-16 shrink-0 rounded-xl border border-border object-cover"
                  />
                )}
                <div className="flex-1">
                  <p className="font-display text-lg">
                    #{r.order_number}{" "}
                    <span className="text-sm font-sans text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("pt-BR")} · {r.kind}
                    </span>
                  </p>
                  {r.order_items.length > 0 && (
                    <p className="mt-0.5 text-sm font-semibold">
                      {r.order_items
                        .map((it) => `${it.product_name} · ${it.quantity} un.`)
                        .join(" + ")}
                    </p>
                  )}
                  <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-sm">
                    <dt className="text-muted-foreground">Nome:</dt>
                    <dd>{r.customer_name}</dd>
                    <dt className="text-muted-foreground">E-mail:</dt>
                    <dd>{r.customer_email}</dd>
                    <dt className="text-muted-foreground">WhatsApp:</dt>
                    <dd>{r.customer_phone || "—"}</dd>
                    <dt className="text-muted-foreground">CPF:</dt>
                    <dd>{formatCpf(r.customer_document)}</dd>
                  </dl>
                  {r.businesses && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Negócio: {r.businesses.name} ·{" "}
                      <a
                        className="underline"
                        href={r.businesses.review_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        link de avaliação
                      </a>
                    </p>
                  )}
                  {r.kind === "revenda" && batchesByOrder[r.id] && (
                    <p className="mt-2 text-sm">
                      Lote:{" "}
                      <Link to="/painel/lotes" className="font-mono font-semibold underline">
                        {batchesByOrder[r.id].code}
                      </Link>
                      {batchesByOrder[r.id].codes_sent_at
                        ? " · códigos marcados como enviados"
                        : " · exporte o CSV na aba Lotes e marque como enviado"}
                    </p>
                  )}
                  {r.kind === "revenda" &&
                    r.payment_status === "pago" &&
                    !batchesByOrder[r.id] &&
                    !r.order_items.some((it) => it.products?.is_blank) && (
                    <div className="mt-2 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm text-amber-800">Pago, mas ainda sem lote.</p>
                        <Button
                          size="sm"
                          onClick={() => {
                            setScanOpenFor(scanOpenFor === r.id ? null : r.id);
                            setScanText("");
                          }}
                          className="h-7 rounded-lg text-xs"
                        >
                          Vincular placas escaneadas
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void generateBatchForOrder(r)}
                          disabled={generatingFor === r.id}
                          className="h-7 rounded-lg text-xs"
                          title="Pega placas em ordem do estoque — só use se a ordem impressa bate com o banco"
                        >
                          {generatingFor === r.id ? "Gerando…" : "Gerar lote do estoque (ordem)"}
                        </Button>
                      </div>
                      {scanOpenFor === r.id && (
                        <div className="rounded-xl border border-border bg-secondary/40 p-3">
                          <p className="text-xs text-muted-foreground">
                            Cole os {r.quantity} códigos das placas (GCARD-00001) ou os links escaneados
                            (gcardpro.com.br/r/…), um por linha. As placas precisam estar livres no estoque.
                          </p>
                          <textarea
                            value={scanText}
                            onChange={(e) => setScanText(e.target.value)}
                            rows={Math.min(12, Math.max(4, r.quantity))}
                            className="mt-2 w-full rounded-lg border border-input bg-background p-2 font-mono text-xs"
                            placeholder="Um código por linha, ex.: GCARD-00007"
                          />
                          <div className="mt-2 flex items-center gap-3">
                            <Button
                              size="sm"
                              className="h-8 rounded-lg text-xs"
                              disabled={generatingFor === r.id}
                              onClick={() => void assignScannedPlates(r)}
                            >
                              {generatingFor === r.id ? "Montando…" : "Montar lote"}
                            </Button>
                            <span className="text-xs text-muted-foreground">
                              {parseScanned(scanText).hex.size + parseScanned(scanText).shorts.size} / {r.quantity} códigos
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <p className="mt-2 text-sm text-muted-foreground">
                    {[r.ship_street, r.ship_number, r.ship_district, r.ship_city, r.ship_state]
                      .filter(Boolean)
                      .join(", ") || "Sem endereço"}
                    {r.ship_zip ? ` · CEP ${formatCep(r.ship_zip)}` : " · CEP —"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-xl">{money(r.total_cents)}</p>
                  <p className="text-sm text-muted-foreground">{r.quantity} un.</p>
                  <span
                    className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                      r.payment_status === "pago"
                        ? "bg-green-100 text-green-800"
                        : "bg-accent text-accent-foreground"
                    }`}
                  >
                    {PAYMENT_LABEL[r.payment_status] ?? r.payment_status}
                  </span>
                  {stageOf(r) === "aguardando" && (
                    <>
                      <p className="mt-1 text-xs text-muted-foreground">{timeAgo(r.created_at)}</p>
                      <p
                        className={`mt-1 max-w-52 text-xs font-semibold ${
                          unpaidReason(r).tone === "red" ? "text-red-700" : "text-amber-700"
                        }`}
                      >
                        {unpaidReason(r).text}
                      </p>
                    </>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-border pt-4">
                <div>
                  <Label className="text-xs">Pagamento</Label>
                  <select
                    value={r.payment_status}
                    onChange={(e) => void patch(r, { payment_status: e.target.value })}
                    className="mt-1 h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {Object.entries(PAYMENT_LABEL).map(([s, label]) => (
                      <option key={s} value={s}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                {r.payment_status !== "pago" && (
                  <div>
                    <Label className="text-xs">Link de pagamento</Label>
                    <div className="mt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          void (async () => {
                            try {
                              const pref = await runCreatePreference({
                                data: { orderNumber: r.order_number },
                              });
                              if (!pref.ok || !pref.url) {
                                toast.error(
                                  pref.ok === false &&
                                    pref.error === "payment_provider_not_configured"
                                    ? "Mercado Pago não está configurado."
                                    : "Não foi possível gerar o link.",
                                );
                                return;
                              }
                              await navigator.clipboard.writeText(pref.url);
                              toast.success(`Link do pedido #${r.order_number} copiado.`);
                            } catch {
                              toast.error("Não foi possível gerar o link.");
                            }
                          })();
                        }}
                      >
                        Gerar e copiar link
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => void sendPaymentLink(r)}
                        disabled={sendingPaymentFor === r.id}
                      >
                        {sendingPaymentFor === r.id ? "Enviando…" : "Enviar por e-mail"}
                      </Button>
                    </div>
                  </div>
                )}
                <div>
                  <Label className="text-xs">Produção</Label>
                  <select
                    value={r.fulfillment_status}
                    onChange={(e) => void patch(r, { fulfillment_status: e.target.value })}
                    className="mt-1 h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {FULFILLMENT.map((s) => (
                      <option key={s} value={s}>
                        {FULFILLMENT_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <Label className="text-xs">Rastreio</Label>
                  <div className="mt-1 flex gap-2">
                    <Input
                      defaultValue={r.tracking_code ?? ""}
                      placeholder="Código de rastreio"
                      className="h-10"
                      id={`t-${r.id}`}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const el = document.getElementById(`t-${r.id}`) as HTMLInputElement | null;
                        void (async () => {
                          try {
                            await runSaveTracking({
                              data: { orderId: r.id, trackingCode: el?.value.trim() || null },
                            });
                            await load();
                            toast.success(`Rastreio do pedido #${r.order_number} salvo.`);
                          } catch {
                            toast.error("Não foi possível salvar o rastreio.");
                          }
                        })();
                      }}
                    >
                      Salvar
                    </Button>
                  </div>
                </div>

                <div className="mt-3 w-full">
                  <Label className="text-xs">Nota interna (só a equipe vê)</Label>
                  <div className="mt-1 flex gap-2">
                    <Input
                      defaultValue={r.internal_notes ?? ""}
                      placeholder="Ex: cliente ligou pedindo prioridade no envio"
                      className="h-10"
                      id={`n-${r.id}`}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const el = document.getElementById(`n-${r.id}`) as HTMLInputElement | null;
                        void patch(r, { internal_notes: el?.value.trim() || null });
                      }}
                    >
                      Salvar nota
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void toggleHistory(r.id)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    {historyOpenId === r.id ? "Ocultar histórico" : "Ver histórico"}
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={deletingFor === r.id}
                        className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        Excluir pedido
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir pedido #{r.order_number}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Apaga o pedido de {r.customer_name} ({r.customer_email}) e os itens dele
                          pra sempre. Não dá pra desfazer. Se já tiver lote gerado, o lote continua
                          existindo, só perde o vínculo com o pedido.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => void deleteOrder(r)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>

              {historyOpenId === r.id && (
                <div className="mt-3 rounded-xl border border-border bg-surface p-3 text-xs">
                  {historyLoading && !historyByOrder[r.id] ? (
                    <p className="text-muted-foreground">Carregando…</p>
                  ) : (historyByOrder[r.id]?.length ?? 0) === 0 ? (
                    <p className="text-muted-foreground">Nenhum evento registrado ainda.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {historyByOrder[r.id]!.map((h) => (
                        <li key={h.id} className="flex flex-wrap items-baseline gap-x-2">
                          <span className="text-muted-foreground">
                            {new Date(h.created_at).toLocaleString("pt-BR")}
                          </span>
                          <span className="font-semibold">{h.action}</span>
                          {h.actor_email && (
                            <span className="text-muted-foreground">por {h.actor_email}</span>
                          )}
                          {h.details && (
                            <span className="text-muted-foreground">
                              {JSON.stringify(h.details)}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
