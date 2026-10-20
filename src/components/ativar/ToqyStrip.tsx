import mascote from "@/assets/toqy/toqui.svg";
import logo from "@/assets/toqy/toqy-logo.svg";

/** Convite discreto para o TOQY no fim do cartão do código (não compete com Ativar/Salvar). */
export function ToqyStrip({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2 transition-colors hover:border-[#0B7A55]/50 hover:bg-[#0B7A55]/5"
    >
      <img src={mascote} alt="" className="size-10 shrink-0" draggable={false} />
      <span className="min-w-0 flex-1 text-xs leading-snug text-muted-foreground">
        Sem site? Crie uma página de links profissional para este código no{" "}
        <img src={logo} alt="TOQY" className="inline-block h-4 w-auto align-[-3px]" draggable={false} />
      </span>
      <span className="shrink-0 text-xs font-bold text-[#0B7A55]">Criar página →</span>
    </a>
  );
}
