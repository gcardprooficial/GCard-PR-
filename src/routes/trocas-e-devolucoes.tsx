import { createFileRoute, Link } from "@tanstack/react-router";
import { PackageCheck, MessageCircle, Mail, ShieldCheck, Wrench, Undo2 } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { WHATSAPP_CONTACTS, whatsappLink } from "@/lib/contact";

export const Route = createFileRoute("/trocas-e-devolucoes")({
  head: () => ({
    meta: [
      { title: "Trocas e devoluções | GCard-PRÓ" },
      { name: "description", content: "Como devolver ou trocar um pedido da GCard-PRÓ: prazos, código de postagem dos Correios sem custo e o que fazer em caso de defeito." },
      { name: "robots", content: "index,follow" },
    ],
  }),
  component: Trocas,
});

const STEPS = [
  ["1", "Avise a gente", "Chame no WhatsApp informando o número do pedido e o motivo (desistência ou defeito). Se for defeito, mande uma foto."],
  ["2", "Receba o código de postagem", "Enviamos um código dos Correios para você levar o pacote a uma agência. Não tem custo nenhum para você."],
  ["3", "Envie o produto", "Embale, de preferência na embalagem original e com a etiqueta que enviamos, e poste com o código."],
  ["4", "Receba a solução", "Depois que o produto chegar e for conferido, devolvemos o valor pago (com o frete) pelo mesmo meio de pagamento, ou trocamos, se for o seu caso."],
] as const;

function Trocas() {
  const wa = WHATSAPP_CONTACTS[0];
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute -top-40 -right-32 size-[28rem] rounded-full bg-primary/15 blur-3xl" />
      <SiteHeader />
      <main className="relative mx-auto max-w-3xl px-5 py-10 sm:py-14">
        <div className="mt-14 sm:mt-16">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary">
            <Undo2 className="size-3.5" /> Política de trocas e devoluções
          </span>
          <h1 className="mt-4 font-display text-3xl leading-tight sm:text-4xl">Não gostou ou veio com defeito? A gente resolve.</h1>
          <p className="mt-3 text-sm text-muted-foreground">Última atualização: outubro de 2026.</p>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            [Undo2, "7 dias para desistir", "Contados do recebimento do pedido, sem precisar explicar o motivo."],
            [PackageCheck, "Devolução sem custo", "Você posta pelos Correios com um código que enviamos. Nada a pagar."],
            [Wrench, "Defeito de fabricação", "Trocamos ou devolvemos o valor. Veja os prazos abaixo."],
          ].map(([Icon, t, d]) => {
            const I = Icon as typeof Undo2;
            return (
              <div key={t as string} className="rounded-2xl border border-border/70 bg-card/70 p-5 card-soft">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-foreground"><I className="size-5" /></span>
                <p className="mt-3 font-bold leading-snug">{t as string}</p>
                <p className="mt-1 text-sm text-muted-foreground">{d as string}</p>
              </div>
            );
          })}
        </div>

        <h2 className="mt-10 font-display text-2xl font-bold">Como devolver</h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2">
          {STEPS.map(([n, t, d]) => (
            <li key={n} className="rounded-2xl border border-border/70 bg-card/70 p-5 card-soft">
              <span className="flex size-8 items-center justify-center rounded-full bg-secondary font-display text-sm font-black text-secondary-foreground">{n}</span>
              <p className="mt-3 font-bold">{t}</p>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </li>
          ))}
        </ol>

        <div className="mt-8 space-y-4 text-[14.5px] leading-[1.85] text-muted-foreground">
          <section className="rounded-2xl border border-border/70 bg-card/60 p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground"><ShieldCheck className="size-4 text-primary" /> Desistência (arrependimento)</h2>
            <p className="mt-2">
              Nas compras feitas pelo site você pode desistir em até <strong>7 dias corridos</strong> a partir do recebimento (Código de Defesa do Consumidor, art. 49).
              Devolvemos o valor pago, incluindo o frete, e o custo da devolução é nosso.
            </p>
          </section>
          <section className="rounded-2xl border border-border/70 bg-card/60 p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground"><Wrench className="size-4 text-primary" /> Produto com defeito</h2>
            <p className="mt-2">
              Se o produto vier com defeito de fabricação, avise em até <strong>90 dias</strong> do recebimento (produto durável, CDC art. 26).
              Corrigimos ou trocamos; se não for possível, devolvemos o valor pago. Também sem custo de envio para você.
            </p>
          </section>
          <section className="rounded-2xl border border-border/70 bg-card/60 p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground"><PackageCheck className="size-4 text-primary" /> Embalagem e etiqueta</h2>
            <p className="mt-2">
              Para a análise ser rápida, devolva o produto <strong>na embalagem original, com todos os itens e a etiqueta de envio que enviamos</strong>, usando o código de postagem.
              Isso nos ajuda a identificar o pedido e a evitar extravio.
            </p>
            <p className="mt-2">
              <strong>Perdeu a embalagem ou a etiqueta?</strong> Avise a gente. Seu direito de devolução não depende disso: embale bem o produto e fale conosco antes de postar,
              que orientamos como enviar. Produto danificado por mau uso pode ter o reembolso reduzido na proporção do dano.
            </p>
          </section>
          <section className="rounded-2xl border border-border/70 bg-card/60 p-5 sm:p-6">
            <h2 className="text-base font-semibold text-foreground">Reembolso</h2>
            <p className="mt-2">
              Depois que recebermos e conferirmos o produto, o valor volta pelo <strong>mesmo meio de pagamento</strong> da compra. O prazo para aparecer na fatura ou na conta depende do banco ou da operadora do cartão.
            </p>
          </section>
          <section className="rounded-2xl border border-border/70 bg-card/60 p-5 sm:p-6">
            <h2 className="text-base font-semibold text-foreground">GCard Plus</h2>
            <p className="mt-2">O GCard Plus é uma assinatura cobrada pela Kiwify e pode ser cancelada quando você quiser, sem multa. Suas placas e QR Codes continuam funcionando se você cancelar.</p>
          </section>
        </div>

        <div className="mt-8 rounded-3xl bg-secondary p-6 text-secondary-foreground">
          <p className="font-display text-xl font-bold">Precisa de ajuda com um pedido?</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a href={whatsappLink(wa.number, "Olá! Quero falar sobre uma troca ou devolução. Pedido nº: ")} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground">
              <MessageCircle className="size-4" /> WhatsApp {wa.display}
            </a>
            <a href="https://instagram.com/gcardpro.oficial" target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/25 px-5 text-sm font-bold text-white hover:bg-white/10">
              <Mail className="size-4" /> @gcardpro.oficial
            </a>
          </div>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          Veja também os <Link to="/termos" className="underline">Termos de uso</Link> e a <Link to="/privacidade" className="underline">Política de privacidade</Link>.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
