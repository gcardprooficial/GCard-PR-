import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { untyped } from "@/lib/db-untyped";
import { PLUS_CHECKOUT, PLUS_PRICE } from "@/lib/plus";

type Sub = { plan: "mensal" | "anual"; status: string; current_period_end: string | null };

/** GCard Plus no /ativar. Some inteira enquanto app_settings.gcard_plus estiver desligada. Placas e QRs nunca dependem disto. */
export function PlusSection() {
  const [on, setOn] = useState(false);
  const [sub, setSub] = useState<Sub | null>(null);

  useEffect(() => {
    const db = untyped(supabase);
    void db.rpc("plus_enabled").then(({ data }: { data: boolean | null }) => setOn(data === true));
    void db
      .from("plus_subscriptions")
      .select("plan, status, current_period_end")
      .order("updated_at", { ascending: false })
      .limit(1)
      .then(({ data }: { data: Sub[] | null }) => setSub(data?.[0] ?? null));
  }, []);

  if (!on) return null;
  const ativa = sub?.status === "ativa";
  const fim = sub?.current_period_end ? new Date(sub.current_period_end).toLocaleDateString("pt-BR") : null;

  return (
    <section aria-labelledby="plus-t" className="mb-6 rounded-2xl border border-border bg-card p-5 card-soft">
      <h2 id="plus-t" className="text-base font-bold">GCard Plus</h2>
      {ativa ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Seu Plus está ativo (plano {sub?.plan}){fim ? `. Próxima cobrança em ${fim}` : ""}. Para cancelar, use o e-mail de compra da Kiwify.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Painel com todas as suas placas e códigos, QR Code próprio ilimitado para imprimir onde quiser, estatísticas de acessos
            (toques NFC e leituras de QR por dia) e relatório mensal por e-mail com aviso se algum destino sair do ar.
          </p>
          <p className="mt-3 rounded-xl bg-muted p-3 text-sm leading-relaxed">
            <strong>Sua placa nunca para.</strong> Placas e ativação são grátis para sempre. Se você cancelar ou a cobrança falhar,
            nenhuma placa e nenhum QR deixa de funcionar: os destinos ficam como estavam e só os recursos do Plus ficam pausados.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(["mensal", "anual"] as const).map((p) => (
              <a
                key={p}
                href={PLUS_CHECKOUT[p]}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border-2 border-border p-4 text-center text-sm font-semibold hover:bg-muted"
              >
                {p === "mensal" ? "Mensal" : "Anual"}
                <span className="mt-1 block font-normal text-muted-foreground">{PLUS_PRICE[p]}</span>
              </a>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Na compra, use o mesmo e-mail desta conta. Com outro e-mail o Plus não é liberado aqui. Cancele quando quiser, sem multa.
          </p>
        </>
      )}
    </section>
  );
}
