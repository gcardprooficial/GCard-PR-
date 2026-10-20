import { BarChart3, Check, Crown, QrCode, Layers, Mail, ShieldCheck } from "lucide-react";
import { PlusStats } from "@/components/PlusStats";
import { BulkDestino } from "@/components/BulkDestino";
import { PlusQrCreator } from "@/components/PlusQrCreator";
import { PLUS_CHECKOUT, PLUS_PRICE } from "@/lib/plus";
import type { DestinationRule } from "@/lib/destination";
import type { PlusSub } from "@/lib/use-plus";

type P = { id: string; short_code: string; status: string; business_name: string | null; destination_url: string | null };

const BENEFITS = [
  { icon: Layers, title: "Painel completo", text: "Todas as suas placas e códigos num lugar, com troca de destino em lote." },
  { icon: QrCode, title: "QR Code próprio ilimitado", text: "Crie quantos quiser para imprimir onde quiser e troque o destino sem reimprimir." },
  { icon: BarChart3, title: "Estatísticas de acessos", text: "Toques de NFC e leituras de QR por dia, por código, com gráfico." },
  { icon: Mail, title: "Relatório e alerta por e-mail", text: "Resumo todo mês e aviso se algum destino sair do ar." },
];

/** Aba GCard Plus: vitrine para quem não assina, painel para quem assina. Placas e QRs nunca dependem disto. */
export function PlusHub(props: {
  plates: P[];
  rules: DestinationRule[];
  allowedUrls: string[];
  active: boolean;
  sub: PlusSub | null;
  onDone: () => void;
}) {
  const { plates, rules, allowedUrls, active, sub, onDone } = props;
  const fim = sub?.current_period_end ? new Date(sub.current_period_end).toLocaleDateString("pt-BR") : null;
  const ativadas = plates.filter((p) => p.status === "ativada");

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-secondary p-6 text-secondary-foreground sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-10 size-48 rounded-full bg-primary/25 blur-3xl" />
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-black text-primary-foreground">
          <Crown className="size-3.5" /> GCARD PLUS
        </span>
        {active ? (
          <>
            <h2 className="mt-3 font-display text-2xl font-bold sm:text-3xl">Seu Plus está ativo</h2>
            <p className="mt-1 text-sm text-white/70">
              Plano {sub?.plan}
              {fim ? ` · próxima cobrança em ${fim}` : ""}. Para cancelar, use o e-mail de compra da Kiwify.
            </p>
          </>
        ) : (
          <>
            <h2 className="mt-3 font-display text-2xl font-bold leading-tight sm:text-3xl">Mais controle sobre os seus códigos</h2>
            <p className="mt-2 max-w-xl text-sm text-white/70">
              Painel, QR Code ilimitado, estatísticas e relatórios. Sem promessa de resultado: só ferramentas para você acompanhar e organizar o que já usa.
            </p>
          </>
        )}
        <p className="mt-4 inline-flex items-start gap-2 rounded-2xl bg-white/10 p-3 text-xs leading-relaxed text-white/90">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>
            <strong>Sua placa nunca para.</strong> Placas e ativação são grátis para sempre. Se você cancelar ou a cobrança falhar, nenhuma placa e nenhum QR
            deixa de funcionar: os destinos ficam como estavam e só os recursos do Plus ficam pausados.
          </span>
        </p>
      </section>

      {!active && (
        <>
          <section className="grid gap-3 sm:grid-cols-2">
            {BENEFITS.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-3 rounded-2xl border border-border bg-card p-4 card-soft">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-foreground">
                  <Icon className="size-5" />
                </span>
                <div>
                  <p className="font-bold">{title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{text}</p>
                </div>
              </div>
            ))}
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            {(["mensal", "anual"] as const).map((p) => (
              <a
                key={p}
                href={PLUS_CHECKOUT[p]}
                target="_blank"
                rel="noopener noreferrer"
                className={`relative rounded-2xl border-2 p-5 text-center transition-shadow hover:shadow-lg ${p === "anual" ? "border-primary bg-primary/10" : "border-border bg-card"}`}
              >
                {p === "anual" && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-[11px] font-black text-primary-foreground">
                    MELHOR VALOR
                  </span>
                )}
                <p className="font-display text-lg font-bold">{p === "mensal" ? "Mensal" : "Anual"}</p>
                <p className="mt-1 text-sm text-muted-foreground">{PLUS_PRICE[p]}</p>
                <span className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-secondary text-sm font-bold text-secondary-foreground">
                  <Check className="size-4" /> Assinar {p === "mensal" ? "mensal" : "anual"}
                </span>
              </a>
            ))}
          </section>
          <p className="text-center text-xs text-muted-foreground">
            Na compra, use o mesmo e-mail desta conta. Com outro e-mail o Plus não é liberado aqui. Cancele quando quiser, sem multa.
          </p>
        </>
      )}

      <PlusQrCreator rules={rules} allowedUrls={allowedUrls} active={active} onDone={onDone} />

      {active && (
        <>
          <PlusStats plates={ativadas} />
          <BulkDestino plates={plates} rules={rules} allowedUrls={allowedUrls} onDone={onDone} />
        </>
      )}
    </div>
  );
}
