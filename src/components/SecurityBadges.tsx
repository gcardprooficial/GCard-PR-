import { BadgeCheck, FileCheck2, Lock, ShieldCheck, Undo2 } from "lucide-react";
import { COMPANY, COMPANY_ADDRESS } from "@/lib/company";

const BADGES = [
  { icon: ShieldCheck, label: "Compra segura", detail: "Mercado Pago" },
  { icon: Lock, label: "Conexão criptografada", detail: "HTTPS" },
  { icon: FileCheck2, label: "Dados protegidos", detail: "LGPD" },
  { icon: Undo2, label: "7 dias para desistir", detail: "CDC, art. 49" },
] as const;

/** Faixa de confiança (selos + identificação da empresa) para checkout e páginas de compra. */
export function SecurityBadges({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-2xl border border-border bg-card p-4 ${className}`}>
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {BADGES.map(({ icon: Icon, label, detail }) => (
          <li key={label} className="flex items-center gap-2.5">
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-xl bg-g-green/15 text-g-green">
              <Icon className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 text-xs leading-tight">
              <span className="block font-bold text-foreground">{label}</span>
              <span className="text-muted-foreground">{detail}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
        <BadgeCheck className="size-4 shrink-0 text-primary" aria-hidden />
        <span>
          <strong className="text-foreground">{COMPANY.legalName}</strong> · CNPJ {COMPANY.cnpj} ·{" "}
          {COMPANY_ADDRESS}
        </span>
      </p>
    </div>
  );
}
