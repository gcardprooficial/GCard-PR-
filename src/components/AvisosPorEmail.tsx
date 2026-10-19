import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { getMarussoConsent, setMarussoConsent } from "@/lib/marusso-consent.functions";
import { MARUSSO_CONSENT_TEXT } from "@/lib/consent";

/** Configurações da conta: interruptor do aceite Marusso. Desligado por padrão; desligar é descadastro total. */
export function AvisosPorEmail() {
  const get = useServerFn(getMarussoConsent);
  const set = useServerFn(setMarussoConsent);
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    get().then((r) => setOn(r.subscribed)).catch(() => setOn(false));
  }, [get]);

  async function change(next: boolean) {
    setBusy(true);
    try {
      const r = await set({ data: { on: next } });
      if (!r.ok) return void toast.error(r.error);
      setOn(r.subscribed);
      toast.success(r.subscribed ? "Pronto, você vai receber as novidades." : "Pronto, cancelamos todos os e-mails de novidades e ofertas.");
    } catch {
      toast.error("Não consegui salvar agora.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="cfg-avisos" className="mb-6 rounded-2xl border border-border bg-card p-5 card-soft">
      <h2 id="cfg-avisos" className="text-base font-bold">Configurações da conta</h2>
      <div className="mt-3 flex items-start gap-3">
        <Switch checked={on === true} disabled={on === null || busy} onCheckedChange={(v) => void change(v)} aria-label="Receber novidades e ofertas da Marusso Produções" className="mt-0.5" />
        <div className="text-sm">
          <p className="leading-relaxed text-muted-foreground">{MARUSSO_CONSENT_TEXT}</p>
          <p className="mt-1 text-xs text-muted-foreground">Desativar cancela todos os e-mails de novidades e ofertas.</p>
        </div>
      </div>
    </section>
  );
}
