import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronDown, Crown, ShieldCheck, Sparkles, Store, Users } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { BENEFITS, FAQ, PricingCards, Preview, STEPS } from "@/components/ativar/PlusHub";
import { PLUS_CHECKOUT, PLUS_PRICE } from "@/lib/plus";

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

function PlusPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden bg-secondary text-secondary-foreground">
          <div className="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-primary/30 blur-3xl" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 md:grid-cols-[1.1fr_1fr] md:py-24">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-black text-primary-foreground"><Crown className="size-3.5" /> GCARD PLUS</span>
              <h1 className="mt-4 font-display text-4xl font-bold leading-tight sm:text-5xl">
                QR Code que <span className="text-primary">você troca</span> sem reimprimir
              </h1>
              <p className="mt-4 max-w-lg text-base text-white/70">
                Crie QR Codes ilimitados com a sua marca, programe o destino por horário e mande relatórios de leituras para os seus clientes. É para quem usa placas e QR Codes no dia a dia do negócio.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <a href={PLUS_CHECKOUT.anual} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-black text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:-translate-y-0.5">
                  <Sparkles className="size-4" /> Assinar o anual
                </a>
                <a href={PLUS_CHECKOUT.mensal} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center rounded-xl border border-white/25 px-5 text-sm font-bold text-white hover:bg-white/10">
                  Prefiro o mensal
                </a>
              </div>
              <p className="mt-3 text-xs text-white/60">{PLUS_PRICE.anual} · {PLUS_PRICE.mensal} · cancele quando quiser</p>
            </div>
            <Preview />
          </div>
        </section>

        <div className="mx-auto max-w-6xl space-y-14 px-5 py-14">
          <section>
            <h2 className="font-display text-2xl font-bold sm:text-3xl">Tudo o que o Plus faz</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {BENEFITS.map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-2xl border border-border bg-card p-5 card-soft">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-primary/20"><Icon className="size-5" /></span>
                  <p className="mt-3 font-bold leading-snug">{title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{text}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="font-display text-2xl font-bold sm:text-3xl">Para quem é</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-5 card-soft">
                <Users className="size-6 text-primary" />
                <p className="mt-2 font-bold">Revendedor e agência</p>
                <p className="mt-1 text-sm text-muted-foreground">Gerencie os códigos de vários clientes em pastas e mande para cada um um link ou PDF com as leituras do código dele.</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5 card-soft">
                <Store className="size-6 text-primary" />
                <p className="mt-2 font-bold">Comércio com campanhas</p>
                <p className="mt-1 text-sm text-muted-foreground">Cardápio no almoço e WhatsApp à noite, promoção que termina sozinha no domingo, tudo no mesmo QR já impresso.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="font-display text-2xl font-bold sm:text-3xl">Como funciona</h2>
            <ol className="mt-5 grid gap-3 sm:grid-cols-3">
              {STEPS.map(([n, t, d]) => (
                <li key={n} className="rounded-2xl border border-border bg-card p-5 card-soft">
                  <span className="flex size-9 items-center justify-center rounded-full bg-secondary font-display font-black text-secondary-foreground">{n}</span>
                  <p className="mt-3 font-bold">{t}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{d}</p>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <PricingCards />
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Na compra, use o e-mail da sua conta GCard-PRÓ. Ainda não tem conta? <Link to="/ativar" className="font-semibold underline">Crie em gcardpro.com.br/ativar</Link> com o mesmo e-mail: o Plus é liberado sozinho.
            </p>
          </section>

          <section className="rounded-3xl border border-primary/40 bg-primary/10 p-6">
            <p className="flex items-center gap-2 text-lg font-bold"><ShieldCheck className="size-5" /> Sua placa nunca para</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Placas e ativação são grátis para sempre. Se você cancelar ou a cobrança falhar, nenhuma placa e nenhum QR deixa de funcionar: os destinos ficam como estavam e só os recursos do Plus ficam pausados.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-bold sm:text-3xl">Perguntas frequentes</h2>
            <div className="mt-4 space-y-2">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group rounded-2xl border border-border bg-card px-5 py-3 card-soft">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold">{q}<ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" /></summary>
                  <p className="mt-2 text-sm text-muted-foreground">{a}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="rounded-3xl bg-secondary p-6 text-center text-secondary-foreground">
            <p className="font-display text-xl font-bold">Já assinou?</p>
            <p className="mt-1 text-sm text-white/70">Entre na sua conta e abra a aba GCard Plus.</p>
            <Link to="/ativar" search={{ aba: "plus" }} className="mt-4 inline-flex h-11 items-center rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground">Abrir meu painel Plus</Link>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
