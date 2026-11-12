import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, ChevronDown, ShieldCheck, Sparkles, Store, Users } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { BENEFITS, FAQ, STEPS } from "@/components/ativar/PlusHub";
import { AreaChart, Donut } from "@/components/ativar/Charts";
import { PLUS_CHECKOUT, PLUS_PRICE } from "@/lib/plus";
import { TrackedAnchor } from "@/components/TrackedAnchor";

export const Route = createFileRoute("/plus")({
  head: () => ({
    meta: [
      { title: "GCard Plus | QR Code dinâmico que você troca sem reimprimir" },
      { name: "description", content: "Assine o GCard Plus: QR Codes ilimitados com a sua marca, destino por horário e data, estatísticas e relatório para o seu cliente. Suas placas nunca param." },
      { name: "robots", content: "index,follow" },
    ],
  }),
  component: PlusPage,
});

const SAMPLE = [3, 5, 4, 7, 6, 9, 8, 12, 10, 14, 13, 17, 15, 19, 18, 22, 20, 24, 23, 27];

/** Exemplo ilustrativo do painel (números inventados, marcados como exemplo). Nada disto é dado de ninguém. */
function PlusPreview() {
  return (
    <div className="card col" style={{ gap: 12, position: "relative", maxWidth: 440, width: "100%", margin: "0 auto" }}>
      <span className="badge green" style={{ position: "absolute", top: -12, right: 16 }}>EXEMPLO ILUSTRATIVO</span>
      <div className="metrics" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {[["Leituras", "248"], ["NFC", "131"], ["QR", "117"]].map(([l, v]) => (
          <div key={l} className="metric"><div className="xs muted">{l}</div><div className="v">{v}</div></div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 10 }}>
        <div className="card" style={{ padding: 8 }}><AreaChart values={SAMPLE} height={90} /></div>
        <div className="card" style={{ padding: 4, display: "grid", placeItems: "center" }}>
          <Donut size={92} parts={[{ value: 131, color: "var(--secondary)", label: "NFC" }, { value: 117, color: "var(--primary)", label: "QR" }]} />
        </div>
      </div>
    </div>
  );
}

function Pricing() {
  return (
    <div className="gl-grid" style={{ marginTop: 18 }}>
      {(["mensal", "anual"] as const).map((p) => (
        <TrackedAnchor key={p} href={PLUS_CHECKOUT[p]} target="_blank" rel="noopener noreferrer" className="card col" style={{ gap: 8, flex: "1 1 300px", maxWidth: 380, textDecoration: "none", color: "inherit", position: "relative", borderColor: p === "anual" ? "var(--brand)" : undefined }}>
          {p === "anual" && <span className="plustag" style={{ position: "absolute", top: -11, left: 18 }}>MELHOR VALOR</span>}
          <b style={{ fontFamily: "var(--font-display)", fontSize: 20 }}>{p === "mensal" ? "Mensal" : "Anual"}</b>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 36, letterSpacing: "-0.03em" }}>{p === "mensal" ? "R$ 19,90" : "R$ 15,90"}<span className="sm muted">/mês</span></div>
          <span className="xs muted">{p === "mensal" ? "Cobrado todo mês" : "R$ 190,80 cobrados uma vez por ano"}</span>
          {["QR dinâmico ilimitado, com a sua marca", "Destino por horário e data", "Estatísticas e relatório para o cliente"].map((x) => (
            <div key={x} className="row sm" style={{ gap: 8 }}><Check size={15} color="var(--brand)" />{x}</div>
          ))}
          <span className={`btn ${p === "anual" ? "goldbtn" : "primary"} block`} style={{ marginTop: 8 }}>Assinar {p}</span>
        </TrackedAnchor>
      ))}
    </div>
  );
}

function PlusPage() {
  const [open, setOpen] = useState<number | null>(0);
  useEffect(() => {
    const els = document.querySelectorAll(".lp .rv");
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.1 });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="v2">
      <div className="lp">
        <div className="lp-bg" aria-hidden="true"><i className="b1" /><i className="b2" /><i className="b3" /></div>
        <SiteHeader />
        <main className="lp-col">
          <section className="lp-hero">
            <div className="lp-herogrid">
              <div className="rv">
                <div className="row" style={{ gap: 8, marginBottom: 12 }}><span className="plustag">GCard Plus</span><span className="badge green">Opção paga</span></div>
                <h1 className="lp-h1">QR Code que <span className="accent">você troca</span> sem reimprimir</h1>
                <p className="lp-lead">Crie QR Codes ilimitados com a sua marca, programe o destino por horário e mande relatórios de leituras para os seus clientes. É para quem usa placas e QR Codes no dia a dia do negócio.</p>
                <div className="row wrap" style={{ gap: 8, marginTop: 20 }}>
                  <TrackedAnchor href={PLUS_CHECKOUT.anual} target="_blank" rel="noopener noreferrer" className="btn goldbtn"><Sparkles size={16} /> Assinar o anual</TrackedAnchor>
                  <TrackedAnchor href={PLUS_CHECKOUT.mensal} target="_blank" rel="noopener noreferrer" className="btn">Prefiro o mensal</TrackedAnchor>
                </div>
                <p className="xs muted" style={{ marginTop: 12 }}>{PLUS_PRICE.anual} · {PLUS_PRICE.mensal} · cancele quando quiser</p>
              </div>
              <div className="rv" style={{ transitionDelay: ".12s" }}><PlusPreview /></div>
            </div>
          </section>

          <section className="lp-sec">
            <div className="lp-head2 rv"><div className="lp-label">O que o Plus faz</div><h2 className="lp-h2">Tudo o que o Plus faz.</h2></div>
            <div className="gl-grid rv">
              {BENEFITS.map(({ icon: Icon, title, text }) => (
                <div key={title} className="card col" style={{ gap: 6, flex: "1 1 280px", maxWidth: 380 }}>
                  <span className="plustag" style={{ width: 34, height: 34, display: "grid", placeItems: "center", padding: 0 }}><Icon size={17} /></span>
                  <b>{title}</b><span className="sm muted">{text}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="lp-sec">
            <div className="lp-head2 rv"><div className="lp-label">Para quem é</div><h2 className="lp-h2">Para quem é.</h2></div>
            <div className="gl-grid rv">
              <div className="card col" style={{ gap: 6, flex: "1 1 320px", maxWidth: 480 }}><Users size={22} color="var(--brand)" /><b>Revendedor e agência</b><span className="sm muted">Gerencie os códigos de vários clientes em pastas e mande para cada um um link ou PDF com as leituras do código dele.</span></div>
              <div className="card col" style={{ gap: 6, flex: "1 1 320px", maxWidth: 480 }}><Store size={22} color="var(--brand)" /><b>Comércio com campanhas</b><span className="sm muted">Cardápio no almoço e WhatsApp à noite, promoção que termina sozinha no domingo, tudo no mesmo QR já impresso.</span></div>
            </div>
          </section>

          <section className="lp-sec">
            <div className="lp-head2 rv"><div className="lp-label">Como funciona</div><h2 className="lp-h2">Três passos, nessa ordem.</h2></div>
            <div className="lp-steps rv" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              {STEPS.map(([n, t, d]) => (<div key={n} className="lp-stepitem"><span className="lp-num">{n}</span><b>{t}</b><p className="sm muted">{d}</p></div>))}
            </div>
          </section>

          <section className="lp-sec">
            <div className="lp-head2 rv"><div className="lp-label">Preços</div><h2 className="lp-h2">Escolha o plano.</h2></div>
            <div className="rv"><Pricing /></div>
            <p className="xs muted center" style={{ marginTop: 14 }}>
              Na compra, use o e-mail da sua conta GCard-PRÓ. Ainda não tem conta? <Link to="/ativar" style={{ textDecoration: "underline" }}>Crie em gcardpro.com.br/ativar</Link> com o mesmo e-mail: o Plus libera sozinho depois da confirmação do pagamento.
            </p>
          </section>

          <section className="lp-sec">
            <div className="gp-custom rv" style={{ margin: "0 auto", maxWidth: 760, textAlign: "center", alignItems: "center" }}>
              <b className="row" style={{ gap: 8, justifyContent: "center" }}><ShieldCheck size={18} /> Sua placa nunca para</b>
              <span className="sm muted">Placas e ativação são grátis para sempre. Se você cancelar ou a cobrança falhar, nenhuma placa e nenhum QR deixa de funcionar: os destinos ficam como estavam e só os recursos do Plus deixam de valer.</span>
            </div>
          </section>

          <section className="lp-sec">
            <div className="lp-head2 rv"><div className="lp-label">Perguntas</div><h2 className="lp-h2">Perguntas frequentes.</h2></div>
            <div className="lp-faq rv">
              {FAQ.map(([q, a], i) => (
                <div key={q} className="lp-qa">
                  <button type="button" className="lp-q" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}><b>{q}</b><ChevronDown size={17} style={{ transform: open === i ? "rotate(180deg)" : undefined, transition: "transform .2s", flex: "none" }} /></button>
                  {open === i && <div className="sm muted" style={{ padding: "0 0 16px" }}>{a}</div>}
                </div>
              ))}
            </div>
          </section>

          <section className="lp-sec lp-final">
            <div className="center rv">
              <h2 className="lp-h2">Já assinou?</h2>
              <p className="lp-sub" style={{ margin: "8px auto 0" }}>Entre na sua conta e abra a aba GCard Plus.</p>
              <div className="row wrap" style={{ gap: 8, justifyContent: "center", marginTop: 16 }}>
                <Link to="/ativar" search={{ aba: "plus" }} className="btn primary">Abrir meu painel Plus <ArrowRight size={16} /></Link>
              </div>
            </div>
          </section>
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}
