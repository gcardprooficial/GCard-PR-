import { BookOpen, Crown, LayoutGrid, User } from "lucide-react";

export type Aba = "codigos" | "plus" | "ajuda" | "conta";
export const ABAS: Aba[] = ["codigos", "plus", "ajuda", "conta"];

const ITEMS = [
  { id: "codigos", label: "Meus códigos", icon: LayoutGrid },
  { id: "plus", label: "GCard Plus", icon: Crown },
  { id: "ajuda", label: "Como usar", icon: BookOpen },
  { id: "conta", label: "Minha conta", icon: User },
] as const;

/** Menus da área do cliente. O Plus é pago: fica separado e em destaque (dourado). */
export function AtivarTabs({ aba, onChange, showPlus }: { aba: Aba; onChange: (a: Aba) => void; showPlus: boolean }) {
  const items = ITEMS.filter((i) => i.id !== "plus" || showPlus);
  return (
    <nav aria-label="Seções" className="sticky top-16 z-30 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-5 py-2">
        {items.map(({ id, label, icon: Icon }) => {
          const on = aba === id;
          const plus = id === "plus";
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              aria-current={on ? "page" : undefined}
              className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
                on
                  ? plus
                    ? "bg-primary text-primary-foreground shadow"
                    : "bg-secondary text-secondary-foreground"
                  : plus
                    ? "text-foreground ring-2 ring-primary/60 hover:bg-primary/15"
                    : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Icon className="size-4" />
              {label}
              {plus && !on && <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-black text-primary-foreground">PRO</span>}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
