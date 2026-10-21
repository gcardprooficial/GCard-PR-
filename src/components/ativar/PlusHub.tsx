import { useMemo, useState } from "react";
import { Folder } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { ArrowLeft, BarChart3, Bell, CalendarClock, Check, ChevronDown, Crown, ExternalLink, Layers, Link2, Palette, QrCode, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { QrStyleStudio } from "@/components/ativar/QrStyleStudio";
import { PlusRules } from "@/components/ativar/PlusRules";
import { PlusReportLinks } from "@/components/ativar/PlusReportLinks";
import { PlusStats } from "@/components/PlusStats";
import { BulkDestino } from "@/components/BulkDestino";
import { PlusQrCreator } from "@/components/PlusQrCreator";
import { PlusQrList, type QrPlate } from "@/components/ativar/PlusQrList";
import { AreaChart, Donut } from "@/components/ativar/Charts";
import { PLUS_CHECKOUT, PLUS_PRICE } from "@/lib/plus";
import type { DestinationRule } from "@/lib/destination";
import type { PlusSub } from "@/lib/use-plus";

type P = QrPlate & { status: string };

export const BENEFITS = [
  { icon: RefreshCw, title: "QR dinâmico: troque sem reimprimir", text: "Imprima o QR uma vez. Mude o link quando quiser e o mesmo QR já leva para o novo destino." },
  { icon: CalendarClock, title: "Destino por horário e data", text: "No almoço abre o cardápio, à noite o WhatsApp. A promoção acaba sozinha no domingo." },
  { icon: Palette, title: "QR com a sua marca", text: "Cores, cantos arredondados, logo no centro e uma frase embaixo, sempre legível no celular." },
  { icon: BarChart3, title: "Painel e estatísticas por código", text: "Leituras por dia, NFC ou QR, ranking e o painel de cada código separado." },
  { icon: Link2, title: "Relatório para o seu cliente", text: "Link privado ou PDF com as leituras do código dele. Só números, nada de dados pessoais." },
  { icon: Layers, title: "Pastas e troca em lote", text: "Organize dezenas de QR por cliente e mude o destino de vários de uma vez." },
  { icon: QrCode, title: "QR Codes ilimitados", text: "Crie quantos precisar para cardápio, Instagram, WhatsApp, catálogo, avaliação." },
  { icon: Bell, title: "Relatório mensal e alerta", text: "Resumo no seu e-mail todo mês e aviso se algum destino sair do ar." },
  { icon: ShieldCheck, title: "Sua placa nunca para", text: "Cancelou? Nada deixa de funcionar. Os destinos ficam como estavam." },
];

export const STEPS = [
  ["1", "Crie", "Dê um nome e cole o link de destino."],
  ["2", "Imprima uma vez", "Baixe o QR em PNG ou SVG e mande imprimir."],
  ["3", "Troque quando quiser", "Mudou o cardápio ou o site? Altere o link aqui. O QR impresso continua valendo."],
];

export const FAQ = [
  ["O que acontece se eu cancelar?", "Nenhuma placa e nenhum QR deixa de funcionar. Os destinos ficam como estavam; só os recursos do Plus (trocar destino dos QR criados no Plus, estatísticas, criar novos) ficam pausados até você reativar."],
  ["As placas que comprei mudam?", "Não. Placas e ativação são grátis para sempre, com ou sem Plus."],
  ["Como libero o Plus?", "Assine com o mesmo e-mail desta conta. A liberação é automática depois da confirmação do pagamento."],
  ["Posso cancelar quando quiser?", "Sim, sem multa, pelo e-mail de compra da Kiwify."],
];

/** Exemplo ilustrativo do painel (números inventados, marcados como exemplo). Nada disto é dado de ninguém. */
export function Preview() {
  const sample = [3, 5, 4, 7, 6, 9, 8, 12, 10, 14, 13, 17, 15, 19, 18, 22, 20, 24, 23, 27];
  return (
    <div className="relative mx-auto w-full max-w-md rotate-1 rounded-3xl border border-white/15 bg-white p-4 text-foreground shadow-2xl">
      <span className="absolute -top-3 right-4 rounded-full bg-primary px-3 py-0.5 text-[10px] font-black text-primary-foreground">EXEMPLO ILUSTRATIVO</span>
      <div className="grid grid-cols-3 gap-2">
        {[["Leituras", "248"], ["NFC", "131"], ["QR", "117"]].map(([l, v]) => (
          <div key={l} className="rounded-xl bg-muted p-2.5">
            <p className="font-display text-xl font-black leading-none">{v}</p>
            <p className="mt-1 text-[10px] font-semibold text-muted-foreground">{l}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-[1.5fr_1fr] gap-2">
        <div className="rounded-xl border border-border p-2">
          <AreaChart values={sample} height={90} />
        </div>
        <div className="flex items-center justify-center rounded-xl border border-border p-1">
          <Donut size={92} parts={[{ value: 131, color: "var(--secondary)", label: "NFC" }, { value: 117, color: "var(--primary)", label: "QR" }]} />
        </div>
      </div>
    </div>
  );
}

/** Cartões de preço do Plus (mensal e anual). */
export function PricingCards() {
  return (
    <section className="grid gap-4 sm:grid-cols-2">
      {(["mensal", "anual"] as const).map((p) => (
        <a
          key={p}
          href={PLUS_CHECKOUT[p]}
          target="_blank"
          rel="noopener noreferrer"
          className={`relative rounded-3xl border-2 p-6 transition-shadow hover:shadow-xl ${p === "anual" ? "border-primary bg-primary/10" : "border-border bg-card"}`}
        >
          {p === "anual" && <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-0.5 text-[11px] font-black text-primary-foreground">MELHOR VALOR</span>}
          <p className="font-display text-xl font-bold">{p === "mensal" ? "Mensal" : "Anual"}</p>
          <p className="mt-2 font-display text-4xl font-black">{p === "mensal" ? "R$ 19,90" : "R$ 15,90"}<span className="text-base font-semibold text-muted-foreground">/mês</span></p>
          <p className="mt-1 text-xs text-muted-foreground">{p === "mensal" ? "Cobrado todo mês" : "R$ 190,80 cobrados uma vez por ano"}</p>
          <ul className="mt-4 space-y-1.5 text-sm">
            {["QR dinâmico ilimitado, com a sua marca", "Destino por horário e data", "Estatísticas e relatório para o cliente"].map((x) => (
              <li key={x} className="flex items-center gap-2"><Check className="size-4 text-primary" />{x}</li>
            ))}
          </ul>
          <span className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-xl bg-secondary text-sm font-bold text-secondary-foreground">Assinar {p}</span>
        </a>
      ))}
    </section>
  );
}

/** Aba GCard Plus: vitrine para quem não assina, central de controle para quem assina. Placas e QRs nunca dependem disto. */
export function PlusHub(props: {
  plates: P[];
  rules: DestinationRule[];
  allowedUrls: string[];
  active: boolean;
  sub: PlusSub | null;
  onDone: () => void;
  onRemove: (p: QrPlate) => void;
  detailId: string | null;
  onDetail: (id: string | null) => void;
}) {
  const { plates, rules, allowedUrls, active, sub, onDone, onRemove, detailId, onDetail } = props;
  const setDetailId = onDetail;
  const fim = sub?.current_period_end ? new Date(sub.current_period_end).toLocaleDateString("pt-BR") : null;
  const ativadas = plates.filter((p) => p.status === "ativada");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState<string | null>(null);
  const tags = useMemo(() => [...new Set(plates.map((p) => p.tag).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, "pt-BR")), [plates]);
  const inTag = (p: P) => tagFilter === null || p.tag === tagFilter;
  async function saveTag(id: string) {
    const v = (tagDraft ?? "").trim().slice(0, 40);
    const { error } = await supabase.from("plates").update({ tag: v || null } as never).eq("id", id);
    if (error) return void toast.error(error.message);
    toast.success(v ? "Pasta salva." : "Pasta removida.");
    setTagDraft(null);
    onDone();
  }
  const [styleTarget, setStyleTarget] = useState<QrPlate | null>(null);
  const detail = active ? plates.find((p) => p.id === detailId) ?? null : null;

  // Visão de um código só: o mesmo painel, filtrado.
  if (detail) {
    return (
      <div className="space-y-6">
        <button type="button" onClick={() => setDetailId(null)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Voltar para o geral
        </button>
        <section className="rounded-3xl bg-secondary p-6 text-secondary-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-black text-primary-foreground"><Crown className="size-3.5" /> GCARD PLUS</span>
          <h2 className="mt-3 font-display text-2xl font-bold">{detail.business_name || detail.short_code}</h2>
          <p className="mt-1 font-mono text-xs text-white/60">{detail.short_code}</p>
          {detail.destination_url && (
            <a href={detail.destination_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex max-w-full items-center gap-1.5 truncate text-sm text-white/80 underline">
              <ExternalLink className="size-3.5 shrink-0" /> {detail.destination_url}
            </a>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Folder className="size-4 text-white/60" />
            <Input
              list="plus-tags"
              value={tagDraft ?? detail.tag ?? ""}
              onChange={(e) => setTagDraft(e.target.value)}
              maxLength={40}
              placeholder="Pasta / etiqueta"
              className="h-9 w-56 rounded-lg border-white/20 bg-white/10 text-sm text-white placeholder:text-white/40"
            />
            <datalist id="plus-tags">{tags.map((t) => <option key={t} value={t} />)}</datalist>
            {tagDraft !== null && tagDraft !== (detail.tag ?? "") && (
              <button type="button" onClick={() => void saveTag(detail.id)} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">Salvar pasta</button>
            )}
          </div>
          <div className="mt-4">
            <button type="button" onClick={() => setStyleTarget(detail)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground">
              <Palette className="size-4" /> QR com a minha marca
            </button>
          </div>
        </section>
        <PlusStats plates={[detail]} />
        <PlusReportLinks plateId={detail.id} />
        <PlusRules plateId={detail.id} defaultUrl={detail.destination_url} rules={rules} allowedUrls={allowedUrls} />
        <QrStyleStudio target={styleTarget} onClose={() => setStyleTarget(null)} onSaved={onDone} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[28px] bg-secondary p-6 text-secondary-foreground sm:p-9">
        <div className="pointer-events-none absolute -right-16 -top-16 size-72 rounded-full bg-primary/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-10 size-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative grid items-center gap-8 md:grid-cols-[1.1fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-black text-primary-foreground">
              <Crown className="size-3.5" /> GCARD PLUS
            </span>
            {active ? (
              <>
                <h2 className="mt-4 font-display text-3xl font-bold leading-tight sm:text-4xl">Central Plus</h2>
                <p className="mt-2 text-sm text-white/70">
                  Plano {sub?.plan}
                  {fim ? ` · próxima cobrança em ${fim}` : ""}. Para cancelar, use o e-mail de compra da Kiwify.
                </p>
              </>
            ) : (
              <>
                <h2 className="mt-4 font-display text-3xl font-bold leading-tight sm:text-4xl">
                  QR Code que <span className="text-primary">você troca</span> sem reimprimir
                </h2>
                <p className="mt-3 max-w-md text-sm text-white/70">
                  Crie QR Codes ilimitados com a sua marca, programe o destino por horário e mande relatórios para os seus clientes. Sem promessa de resultado: ferramentas para você ter controle.
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <a href={PLUS_CHECKOUT.anual} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-black text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:-translate-y-0.5">
                    <Sparkles className="size-4" /> Assinar o anual
                  </a>
                  <a href={PLUS_CHECKOUT.mensal} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center rounded-xl border border-white/25 px-5 text-sm font-bold text-white hover:bg-white/10">
                    Prefiro o mensal
                  </a>
                </div>
                <p className="mt-3 text-xs text-white/60">{PLUS_PRICE.anual} · {PLUS_PRICE.mensal} · cancele quando quiser</p>
              </>
            )}
          </div>
          {!active && <Preview />}
        </div>
      </section>

      {!active && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-2xl border border-border bg-card p-5 card-soft">
                <span className="flex size-11 items-center justify-center rounded-xl bg-primary/20 text-foreground">
                  <Icon className="size-5" />
                </span>
                <p className="mt-3 font-bold leading-snug">{title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{text}</p>
              </div>
            ))}
          </section>

          <section>
            <h3 className="font-display text-xl font-bold">Como funciona</h3>
            <ol className="mt-3 grid gap-3 sm:grid-cols-3">
              {STEPS.map(([n, t, d]) => (
                <li key={n} className="rounded-2xl border border-border bg-card p-5 card-soft">
                  <span className="flex size-9 items-center justify-center rounded-full bg-secondary font-display font-black text-secondary-foreground">{n}</span>
                  <p className="mt-3 font-bold">{t}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{d}</p>
                </li>
              ))}
            </ol>
          </section>

          <PricingCards />
          <p className="-mt-4 text-center text-xs text-muted-foreground">Na compra, use o mesmo e-mail desta conta. Com outro e-mail o Plus não é liberado aqui.</p>

          <section className="rounded-3xl border border-primary/40 bg-primary/10 p-5">
            <p className="flex items-center gap-2 font-bold"><ShieldCheck className="size-5" /> Sua placa nunca para</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Placas e ativação são grátis para sempre. Se você cancelar ou a cobrança falhar, nenhuma placa e nenhum QR deixa de funcionar: os destinos ficam como estavam e só os recursos do Plus ficam pausados.
            </p>
          </section>

          <section>
            <h3 className="font-display text-xl font-bold">Perguntas frequentes</h3>
            <div className="mt-3 space-y-2">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group rounded-2xl border border-border bg-card px-5 py-3 card-soft">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold">
                    {q}
                    <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-2 text-sm text-muted-foreground">{a}</p>
                </details>
              ))}
            </div>
          </section>
        </>
      )}

      {active && (
        <>
          {tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <Folder className="size-4 text-muted-foreground" />
              {[null, ...tags].map((t) => (
                <button key={t ?? "todas"} type="button" onClick={() => setTagFilter(t)} className={`rounded-full border px-3 py-1 text-xs font-semibold ${tagFilter === t ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}>
                  {t ?? "Todas as pastas"}
                </button>
              ))}
            </div>
          )}
          <PlusStats plates={ativadas.filter(inTag)} onOpen={setDetailId} />
          <PlusQrList plates={plates.filter(inTag)} rules={rules} allowedUrls={allowedUrls} active={active} onRemove={onRemove} onDone={onDone} onOpen={setDetailId} onStyle={setStyleTarget} />
        </>
      )}

      <PlusQrCreator rules={rules} allowedUrls={allowedUrls} active={active} onDone={onDone} />
      {!active && <PlusQrList plates={plates} rules={rules} allowedUrls={allowedUrls} active={active} onRemove={onRemove} onDone={onDone} />}

      {active && <BulkDestino plates={plates} rules={rules} allowedUrls={allowedUrls} onDone={onDone} />}
      <QrStyleStudio target={styleTarget} onClose={() => setStyleTarget(null)} onSaved={onDone} />
    </div>
  );
}
