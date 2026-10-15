import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getDomainExpiry, setDomainExpiry } from "@/lib/reports.functions";

/** Aviso no painel quando o domínio vence em até 60 dias (ou venceu). A data fica em app_settings.domain_expires_at. */
export function DomainExpiryBanner({ editable = false }: { editable?: boolean }) {
  const get = useServerFn(getDomainExpiry);
  const set = useServerFn(setDomainExpiry);
  const [date, setDate] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    get().then((r) => setDate(r.date)).catch(() => setDate(null));
  }, [get]);

  if (date === undefined) return null;
  const days = date ? Math.ceil((new Date(`${date}T12:00:00`).getTime() - Date.now()) / 86_400_000) : null;

  async function save(value: string) {
    if (!value) return;
    try {
      await set({ data: { date: value } });
      setDate(value);
      toast.success("Data do domínio salva.");
    } catch {
      toast.error("Não consegui salvar.");
    }
  }

  const alert = days !== null && days <= 60;
  if (!alert && !editable) return null;
  return (
    <div
      role={alert ? "alert" : undefined}
      className={`mb-4 rounded-xl border p-3 text-sm ${alert ? "border-red-300 bg-red-50 font-semibold text-red-900" : "border-border bg-card text-muted-foreground"}`}
    >
      {days === null
        ? "Data de vencimento do domínio não cadastrada."
        : days < 0
          ? `O domínio gcardpro.com.br VENCEU há ${-days} dia(s). Renove agora.`
          : alert
            ? `O domínio gcardpro.com.br vence em ${days} dia(s) (${date}). Renove.`
            : `Domínio vence em ${date} (${days} dias).`}
      {editable && (
        <label className="ml-3 inline-flex items-center gap-2 font-normal">
          Vence em
          <input type="date" defaultValue={date ?? ""} onBlur={(e) => save(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1 text-foreground" />
        </label>
      )}
    </div>
  );
}
