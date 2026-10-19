import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade | GCard-PRÓ" },
      { name: "description", content: "Como a GCard-PRÓ trata seus dados pessoais." },
      { name: "robots", content: "index,follow" },
    ],
  }),
  component: Privacidade,
});

function Privacidade() {
  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
      <div className="pointer-events-none absolute inset-0 noise-bg opacity-40" />
      <div className="pointer-events-none absolute -top-40 -right-32 size-[28rem] rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute top-60 -left-32 size-[24rem] rounded-full bg-secondary/5 blur-3xl" />

      <SiteHeader />
      <div className="relative mx-auto max-w-3xl px-5 py-10 sm:py-14">
        <div className="mt-14 sm:mt-16 animate-rise-sm delay-1">
          <span className="inline-flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/10 px-3.5 py-1 text-xs font-semibold text-green-700">
            <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            LGPD — seus dados protegidos
          </span>
          <h1 className="mt-4 font-display text-3xl sm:text-4xl leading-tight text-foreground">
            Política de Privacidade
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Última atualização: outubro de 2026.
          </p>
        </div>

        <div className="mt-10 space-y-7 animate-rise-sm delay-2">
          <Section n="1" title="Dados que coletamos" icon="clipboard">
            <p>
              Para processar um pedido coletamos: nome, CPF, e-mail, telefone/WhatsApp, endereço de
              entrega e o negócio do Google que você deseja vincular à placa. Esses dados são
              informados por você durante a compra.
            </p>
            <p>
              O controlador dos dados é <strong>Marusso Produções</strong>, CNPJ 68.194.199/0001-70,
              Romeu Ferigati, Indaiatuba/SP.
            </p>
          </Section>

          <Section n="2" title="Para que usamos" icon="target">
            <p>
              Para emitir, produzir e entregar o seu pedido, enviar a confirmação e o código de
              rastreio, e prestar suporte. Se você marcar a caixa de novidades, também para enviar
              avisos e ofertas dos produtos da Marusso Produções (GCard-PRÓ e TOQY) por e-mail. Essa
              caixa nunca vem marcada, guardamos a data, a origem e a versão do texto que você viu, e
              você sai da lista quando quiser pelo link no fim de cada e-mail. Não vendemos seus
              dados nem os compartilhamos com terceiros para fins de marketing.
            </p>
            <p>
              Há uma segunda caixa, separada da anterior, nunca marcada e nunca obrigatória: se você marcar, a{" "}
              <strong>Marusso Produções</strong>, CNPJ 68.194.199/0001-70, Indaiatuba/SP, envia por e-mail
              novidades e ofertas dos seus produtos (TOQY, GCard-PRÓ, cursos e outros produtos). A finalidade é
              apenas essa comunicação. Guardamos a data, a origem e a versão do texto que você viu. Você pode sair
              quando quiser: nas Configurações da conta (em gcardpro.com.br/ativar) ou pelo link no fim de cada
              e-mail. Desativar cancela todos os e-mails de novidades e ofertas.
            </p>
          </Section>

          <Section n="3" title="Leitura das placas" icon="scan">
            <p>
              Quando alguém aproxima ou escaneia uma placa, registramos apenas dados não pessoais
              (tipo de dispositivo e país aproximado) para gerar as estatísticas de uso. Não
              guardamos o endereço IP nem identificamos quem fez a leitura. Para contar pessoas
              diferentes no mesmo dia, usamos um código irreversível que muda todo dia e não permite
              reconhecer ninguém. Acessos automáticos (como a pré-visualização de links) são separados.
            </p>
          </Section>

          <Section n="4" title="Pagamento" icon="credit-card">
            <p>
              Os dados de pagamento (cartão, Pix) são processados diretamente pelo provedor de
              pagamento. A GCard-PRÓ não recebe nem armazena número de cartão.
            </p>
          </Section>

          <Section n="5" title="Compartilhamento operacional" icon="share">
            <p>
              Usamos serviços de terceiros estritamente para operar o pedido: hospedagem e banco de
              dados, provedor de pagamento, serviço de e-mail e a API do Google Places para
              identificar o negócio. Cada um recebe apenas o dado necessário para a sua função.
            </p>
          </Section>

          <Section n="6" title="De onde você veio (cookie próprio)" icon="clock">
            <p>
              Na sua primeira visita guardamos, num cookie do nosso site por 30 dias, de onde você veio
              (por exemplo o link de um vídeo ou rede social) e a página em que entrou. Usamos isso
              para saber quais canais trazem clientes. Não é cookie de terceiros e não identifica você
              sozinho; ele só se liga ao seu cadastro ou pedido se você criar conta ou comprar.
            </p>
          </Section>

          <Section n="7" title="Retenção" icon="clock">
            <p>
              Mantemos os dados do pedido pelo tempo necessário para cumprir obrigações fiscais e de
              garantia. Depois disso, são anonimizados ou excluídos.
            </p>
          </Section>

          <Section n="8" title="Seus direitos (LGPD)" icon="shield">
            <p>
              Você pode solicitar acesso, correção ou exclusão dos seus dados, e revogar
              consentimento, pelo Instagram{" "}
              <a
                className="text-foreground underline underline-offset-2 decoration-primary/60 hover:decoration-primary"
                href="https://instagram.com/gcardpro.oficial"
                target="_blank"
                rel="noopener noreferrer"
              >
                @gcardpro.oficial
              </a>
              .
            </p>
          </Section>
        </div>

      </div>
      <SiteFooter />
    </div>
  );
}

function Section({ n, title, children }: { n: string; title: string; icon?: string; children: React.ReactNode }) {
  return (
    <section className="relative rounded-2xl border border-border/70 bg-card/60 backdrop-blur-sm p-5 sm:p-6 card-soft hover:border-primary/25 transition-colors">
      <div className="flex items-start gap-4">
        <div className="shrink-0 flex items-center justify-center size-9 rounded-xl bg-primary/15 font-display text-sm font-bold text-primary border border-primary/20">
          {n}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <div className="mt-3 text-[14.5px] leading-[1.85] text-muted-foreground">
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
