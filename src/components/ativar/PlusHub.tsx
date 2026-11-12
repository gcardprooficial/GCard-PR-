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
    <div className="card col" style={{ gap: 12, position: "relative", maxWidth: 440, width: "100%", margin: "0 auto" }}>
      <span className="badge green" style={{ position: "absolute", top: -12, right: 16 }}>EXEMPLO ILUSTRATIVO</span>
      <div className="metrics" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {[["Leituras", "248"], ["NFC", "131"], ["QR", "117"]].map(([l, v]) => (
          <div key={l} className="metric"><div className="xs muted">{l}</div><div className="v">{v}</div></div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 10 }}>
        <div className="card" style={{ padding: 8 }}><AreaChart values={sample} height={90} /></div>
        <div className="card" style={{ padding: 4, display: "grid", placeItems: "center" }}>
          <Donut size={92} parts={[{ value: 131, color: "var(--brand)", label: "NFC" }, { value: 117, color: "var(--ink)", label: "QR" }]} />
        </div>
      </div>
    </div>
  );
}

/** Cartões de preço do Plus (mensal e anual). */
export function PricingCards() {
  return (
    <section className="gl-grid">
      {(["mensal", "anual"] as const).map((p) => (
        <a key={p} href={PLUS_CHECKOUT[p]} target="_blank" rel="noopener noreferrer" className="card col" style={{ gap: 8, flex: "1 1 300px", maxWidth: 380, textDecoration: "none", color: "inherit", position: "relative", borderColor: p === "anual" ? "var(--brand)" : undefined }}>
          {p === "anual" && <span className="plustag" style={{ position: "absolute", top: -11, left: 18 }}>MELHOR VALOR</span>}
          <b style={{ fontFamily: "var(--font-display)", fontSize: 20 }}>{p === "mensal" ? "Mensal" : "Anual"}</b>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 36, letterSpacing: "-0.03em" }}>{p === "mensal" ? "R$ 19,90" : "R$ 15,90"}<span className="sm muted">/mês</span></div>
          <span className="xs muted">{p === "mensal" ? "Cobrado todo mês" : "R$ 190,80 cobrados uma vez por ano"}</span>
          {["QR dinâmico ilimitado, com a sua marca", "Destino por horário e data", "Estatísticas e relatório para o cliente"].map((x) => (
            <div key={x} className="row sm" style={{ gap: 8 }}><Check size={15} color="var(--brand)" />{x}</div>
          ))}
          <span className={`btn ${p === "anual" ? "goldbtn" : "primary"} block`} style={{ marginTop: 8 }}>Assinar {p}</span>
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
        <button type="button" onClick={() => setDetailId(null)} className="btn" style={{ alignSelf: "flex-start" }}>
          <ArrowLeft size={16} /> Voltar para o geral
        </button>
        <section className="card goldframe col" style={{ gap: 8 }}>
          <span className="plustag" style={{ alignSelf: "flex-start" }}>GCard Plus</span>
          <h2>{detail.business_name || detail.short_code}</h2>
          <p className="xs muted font-mono">{detail.short_code}</p>
          {detail.destination_url && (
            <a href={detail.destination_url} target="_blank" rel="noopener noreferrer" className="sm row" style={{ gap: 6, textDecoration: "underline", wordBreak: "break-all" }}>
              <ExternalLink className="size-3.5 shrink-0" /> {detail.destination_url}
            </a>
          )}
          <div className="row wrap" style={{ gap: 8 }}>
            <Folder className="size-4 muted" />
            <input
              list="plus-tags"
              value={tagDraft ?? detail.tag ?? ""}
              onChange={(e) => setTagDraft(e.target.value)}
              maxLength={40}
              placeholder="Pasta / etiqueta"
              className="input"
              style={{ width: 220 }}
            />
            <datalist id="plus-tags">{tags.map((t) => <option key={t} value={t} />)}</datalist>
            {tagDraft !== null && tagDraft !== (detail.tag ?? "") && (
              <button type="button" onClick={() => void saveTag(detail.id)} className="btn primary">Salvar pasta</button>
            )}
            <button type="button" onClick={() => setStyleTarget(detail)} className="btn goldbtn"><Palette size={16} /> QR com a minha marca</button>
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
      <section className="card goldframe" style={{ padding: 28 }}>
        <div className="grid items-center gap-8 md:grid-cols-[1.1fr_1fr]">
          <div>
            <span className="plustag"><Crown className="mr-1 inline size-3.5" /> GCard Plus</span>
            {active ? (
              <>
                <h1 style={{ marginTop: 12 }}>Central Plus</h1>
                <p className="sm muted" style={{ marginTop: 8 }}>
                  Plano {sub?.plan}
                  {fim ? ` · próxima cobrança em ${fim}` : ""}. Para cancelar, use o e-mail de compra da Kiwify.
                </p>
              </>
            ) : (
              <>
                <h1 style={{ marginTop: 12 }}>QR Code que <span className="accent">você troca</span> sem reimprimir</h1>
                <p className="muted" style={{ marginTop: 10, maxWidth: 480 }}>
                  Crie QR Codes ilimitados com a sua marca, programe o destino por horário e mande relatórios para os seus clientes. Sem promessa de resultado: ferramentas para você ter controle.
                </p>
                <div className="row wrap" style={{ gap: 8, marginTop: 18 }}>
                  <a href={PLUS_CHECKOUT.anual} target="_blank" rel="noopener noreferrer" className="btn goldbtn"><Sparkles size={16} /> Assinar o anual</a>
                  <a href={PLUS_CHECKOUT.mensal} target="_blank" rel="noopener noreferrer" className="btn">Prefiro o mensal</a>
                </div>
                <p className="xs muted" style={{ marginTop: 10 }}>{PLUS_PRICE.anual} · {PLUS_PRICE.mensal} · cancele quando quiser</p>
              </>
            )}
          </div>
          {!active && <Preview />}
        </div>
      </section>

      {!active && (
        <>
          <section className="gl-grid">
            {BENEFITS.map(({ icon: Icon, title, text }) => (
              <div key={title} className="card col" style={{ gap: 6, flex: "1 1 280px", maxWidth: 380 }}>
                <span className="plustag" style={{ width: 34, height: 34, display: "grid", placeItems: "center", padding: 0 }}><Icon size={17} /></span>
                <b>{title}</b><span className="sm muted">{text}</span>
              </div>
            ))}
          </section>

          <section>
            <h2 className="mb">Como funciona</h2>
            <div className="lp-steps" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              {STEPS.map(([n, t, d]) => (<div key={n} className="lp-stepitem"><span className="lp-num">{n}</span><b>{t}</b><p className="sm muted">{d}</p></div>))}
            </div>
          </section>

          <PricingCards />
          <p className="xs muted center">Na compra, use o mesmo e-mail desta conta. Com outro e-mail o Plus não é liberado aqui.</p>

          <section className="card goldframe col" style={{ gap: 6 }}>
            <b className="row" style={{ gap: 8 }}><ShieldCheck size={18} /> Sua placa nunca para</b>
            <span className="sm muted">
              Placas e ativação são grátis para sempre. Se você cancelar ou a cobrança falhar, nenhuma placa e nenhum QR deixa de funcionar: os destinos ficam como estavam e só os recursos do Plus ficam pausados.
            </span>
          </section>

          <section>
            <h2 className="mb">Perguntas frequentes</h2>
            <div className="lp-faq">
              {FAQ.map(([q, a]) => (
                <details key={q} className="lp-qa group">
                  <summary className="lp-q" style={{ listStyle: "none", cursor: "pointer" }}><b>{q}</b><ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" /></summary>
                  <div className="sm muted" style={{ padding: "0 0 16px" }}>{a}</div>
                </details>
              ))}
            </div>
          </section>
        </>
      )}

      {active && (
        <>
          {tags.length > 0 && (
            <div className="seg">
              <Folder className="size-4 muted" style={{ alignSelf: "center" }} />
              {[null, ...tags].map((t) => (
                <button key={t ?? "todas"} type="button" onClick={() => setTagFilter(t)} className={`chip ${tagFilter === t ? "on" : ""}`}>
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
