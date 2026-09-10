import { createFileRoute, Link } from "@tanstack/react-router";

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
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-5 py-16">
        <Link to="/" className="font-display text-lg">
          GCard<span className="text-primary">-PRÓ</span>
        </Link>
        <h1 className="mt-8 text-3xl">Política de Privacidade</h1>
        <p className="mt-2 text-sm text-muted-foreground">Última atualização: setembro de 2026.</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-base font-semibold text-foreground">1. Dados que coletamos</h2>
            <p>
              Para processar um pedido coletamos: nome, CPF, e-mail, telefone/WhatsApp, endereço de
              entrega e o negócio do Google que você deseja vincular à placa. Esses dados são
              informados por você durante a compra.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground">2. Para que usamos</h2>
            <p>
              Exclusivamente para emitir, produzir e entregar o seu pedido, enviar a confirmação e o
              código de rastreio, e prestar suporte. Não vendemos nem compartilhamos seus dados com
              terceiros para fins de marketing.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground">3. Leitura das placas</h2>
            <p>
              Quando alguém aproxima ou escaneia uma placa, registramos apenas dados não pessoais
              (tipo de dispositivo e país aproximado) para gerar as estatísticas de uso. Não
              guardamos o endereço IP nem identificamos quem fez a leitura.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground">4. Pagamento</h2>
            <p>
              Os dados de pagamento (cartão, Pix) são processados diretamente pelo provedor de
              pagamento. A GCard-PRÓ não recebe nem armazena número de cartão.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground">5. Compartilhamento operacional</h2>
            <p>
              Usamos serviços de terceiros estritamente para operar o pedido: hospedagem e banco de
              dados, provedor de pagamento, serviço de e-mail e a API do Google Places para
              identificar o negócio. Cada um recebe apenas o dado necessário para a sua função.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground">6. Retenção</h2>
            <p>
              Mantemos os dados do pedido pelo tempo necessário para cumprir obrigações fiscais e de
              garantia. Depois disso, são anonimizados ou excluídos.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground">7. Seus direitos (LGPD)</h2>
            <p>
              Você pode solicitar acesso, correção ou exclusão dos seus dados, e revogar
              consentimento, pelo Instagram{" "}
              <a
                className="text-foreground underline"
                href="https://instagram.com/gcardpro.oficial"
                target="_blank"
                rel="noopener noreferrer"
              >
                @gcardpro.oficial
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-10 flex gap-4 text-sm">
          <Link to="/" className="text-foreground underline">
            Início
          </Link>
          <Link to="/termos" className="text-foreground underline">
            Termos de uso
          </Link>
        </div>
      </div>
    </div>
  );
}
