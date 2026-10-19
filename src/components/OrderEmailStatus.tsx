import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fixOrderEmail } from "@/lib/panel.functions";

export type EmailEventRow = { order_id: string; event_type: string; status: string; delivery_status: string | null; delivery_detail: string | null };

const LABEL: Record<string, string> = {
  pedido_recebido: "Recebemos seu pedido",
  pagamento_confirmado: "Pagamento confirmado",
  pedido_enviado: "Pedido enviado",
  pedido_entregue: "Pedido entregue",
  lote_criado: "Lote criado",
};

/** Estado do e-mail: enviado, entregue, bounce, suprimido. Bounce/suprimido/reclamação em vermelho. */
function stateOf(e: EmailEventRow): { text: string; bad: boolean } {
  if (e.status === "failed") return { text: "falhou ao enviar", bad: true };
  if (e.status !== "sent") return { text: e.status === "queued" ? "na fila (sem chave de envio)" : "enviando", bad: false };
  switch (e.delivery_status) {
    case "entregue": return { text: "entregue", bad: false };
    case "atrasado": return { text: "enviado, entrega atrasada", bad: false };
    case "bounce": return { text: "BOUNCE (e-mail não existe ou caixa cheia)", bad: true };
    case "suprimido": return { text: "SUPRIMIDO (endereço bloqueado no Resend)", bad: true };
    case "reclamacao": return { text: "marcado como spam", bad: true };
    default: return { text: "enviado", bad: false };
  }
}

export function OrderEmailStatus({ orderId, events, onFixed }: { orderId: string; events: EmailEventRow[]; onFixed: () => void }) {
  const fix = useServerFn(fixOrderEmail);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const hasProblem = events.some((e) => stateOf(e).bad);

  async function apply() {
    setBusy(true);
    try {
      const r = await fix({ data: { orderId, email } });
      toast.success(r.resent.length ? `E-mail corrigido e ${r.resent.length} confirmação(ões) reenviada(s).` : "E-mail corrigido.");
      setOpen(false);
      setEmail("");
      onFixed();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui corrigir o e-mail.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-1.5 text-xs">
      {events.length > 0 && (
        <ul className="space-y-0.5">
          {events.map((e) => {
            const s = stateOf(e);
            return (
              <li key={e.event_type} className={s.bad ? "font-semibold text-destructive" : "text-muted-foreground"} title={e.delivery_detail ?? undefined}>
                {LABEL[e.event_type] ?? e.event_type}: {s.text}
              </li>
            );
          })}
        </ul>
      )}
      <button type="button" className={`mt-1 underline ${hasProblem ? "font-semibold text-destructive" : "text-muted-foreground"}`} onClick={() => setOpen((v) => !v)}>
        Corrigir e-mail e reenviar
      </button>
      {open && (
        <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="novo e-mail do cliente" type="email" className="h-8 text-xs" />
          <Button size="sm" className="h-8 rounded-lg text-xs" disabled={busy || !email.includes("@")} onClick={() => void apply()}>
            {busy ? "Salvando…" : "Salvar e reenviar"}
          </Button>
        </div>
      )}
    </div>
  );
}
