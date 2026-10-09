import { BUSINESS_HOURS } from "@/lib/business-hours";

/** Aviso bem visível de horário de produção (checkout, tela de pagamento, retorno). */
export function ProductionNotice({ className = "" }: { className?: string }) {
  return (
    <div role="note" className={`rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 text-left text-amber-950 ${className}`}>
      <p className="text-sm font-bold sm:text-base">Horário de produção: {BUSINESS_HOURS}</p>
      <p className="mt-1 text-xs leading-relaxed sm:text-sm">
        <strong>Não produzimos nem enviamos aos sábados, domingos e feriados.</strong> Pedido feito ou pago no fim de
        semana entra na fila na segunda-feira, e o código de rastreio só chega depois do despacho, em dia útil.
      </p>
    </div>
  );
}
