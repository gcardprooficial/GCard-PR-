import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { searchBusinesses, type BusinessResult } from "@/lib/places.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

/** Busca o negócio no Google (mesmo gerador do site) e devolve o link de avaliação pro painel. */
export function ReviewLinkPicker({
  open,
  onOpenChange,
  initialTerm,
  onPick,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialTerm: string;
  onPick: (r: BusinessResult) => void;
}) {
  const runSearch = useServerFn(searchBusinesses);
  const [term, setTerm] = useState(initialTerm);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BusinessResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (term.trim().length < 3) return setError("Digite pelo menos 3 letras do nome do negócio.");
    setLoading(true);
    setError(null);
    try {
      const res = await runSearch({ data: { query: term.trim() } });
      if (res.ok) setResults(res.results);
      else {
        setResults(null);
        setError(res.error);
      }
    } catch {
      setResults(null);
      setError("Não conseguimos buscar agora. Tente de novo em instantes.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] w-[calc(100vw-1.5rem)] max-w-xl overflow-y-auto rounded-3xl">
        <DialogTitle>Buscar link de avaliação</DialogTitle>
        <DialogDescription>Digite o nome do negócio como aparece no Google, com a cidade ou bairro.</DialogDescription>
        <form onSubmit={submit} className="flex gap-2">
          <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Ex.: Barbearia do João, Centro, Campinas" className="h-11 flex-1 rounded-xl" aria-label="Nome do negócio" autoFocus />
          <Button type="submit" disabled={loading} className="h-11 rounded-xl font-bold">
            {loading ? "Buscando…" : "Buscar"}
          </Button>
        </form>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p>}
        {results && results.length === 0 && <p className="text-sm text-muted-foreground">Nenhum negócio encontrado. Tente o nome completo com a cidade.</p>}
        <ul className="space-y-2">
          {results?.map((r) => (
            <li key={r.placeId} className="flex items-center justify-between gap-3 rounded-2xl border border-border p-3">
              <div className="min-w-0">
                <p className="font-bold leading-tight">{r.name}</p>
                <p className="text-xs text-muted-foreground">{r.address}</p>
                {r.rating !== null && <p className="text-xs font-semibold">★ {r.rating.toFixed(1)}{r.reviews !== null ? ` · ${r.reviews} avaliações` : ""}</p>}
              </div>
              <Button size="sm" className="shrink-0 rounded-xl font-bold" onClick={() => { onPick(r); onOpenChange(false); }}>
                Usar este
              </Button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
