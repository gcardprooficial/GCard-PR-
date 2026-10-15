import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { reportAbuse } from "@/lib/abuse.functions";

export const Route = createFileRoute("/denunciar")({
  validateSearch: z.object({ codigo: z.string().optional().catch(undefined) }),
  head: () => ({ meta: [{ title: "Denunciar um código | GCard-PRÓ" }, { name: "robots", content: "noindex" }] }),
  component: Denunciar,
});

function Denunciar() {
  const { codigo } = Route.useSearch();
  const run = useServerFn(reportAbuse);
  const [code, setCode] = useState(codigo ?? "");
  const [reason, setReason] = useState<"golpe" | "conteudo_ilegal" | "outro">("golpe");
  const [details, setDetails] = useState("");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await run({ data: { code, reason, details: details || undefined, contact: contact || undefined } });
      if (r.ok) setDone(true);
      else toast.error(r.error);
    } catch {
      toast.error("Confira o código (formato GCARD-00001) e tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-5 py-10">
      <div className="w-full max-w-md rounded-3xl bg-card p-8 card-soft">
        <h1 className="text-xl">Denunciar um código</h1>
        {done ? (
          <>
            <p className="mt-3 text-sm text-muted-foreground">Recebemos a denúncia. Nossa equipe vai analisar e, se for o caso, desativar o código.</p>
            <Button asChild className="mt-6 w-full"><Link to="/">Voltar ao início</Link></Button>
          </>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">Use isto se um código GCard-PRÓ estiver levando a um golpe ou a conteúdo ilegal.</p>
            <div>
              <Label htmlFor="c">Código (está na placa, ex.: GCARD-00001)</Label>
              <Input id="c" value={code} onChange={(e) => setCode(e.target.value)} className="mt-1 h-11 font-mono" required />
            </div>
            <div>
              <Label htmlFor="r">Motivo</Label>
              <select id="r" value={reason} onChange={(e) => setReason(e.target.value as typeof reason)} className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm">
                <option value="golpe">Golpe ou fraude</option>
                <option value="conteudo_ilegal">Conteúdo ilegal</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <div>
              <Label htmlFor="d">O que aconteceu (opcional)</Label>
              <textarea id="d" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={500} rows={3} className="mt-1 w-full rounded-xl border border-input bg-background p-3 text-sm" />
            </div>
            <div>
              <Label htmlFor="k">Seu contato, se quiser retorno (opcional)</Label>
              <Input id="k" value={contact} onChange={(e) => setContact(e.target.value)} maxLength={120} className="mt-1 h-11" />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>{busy ? "Enviando…" : "Enviar denúncia"}</Button>
          </form>
        )}
      </div>
    </div>
  );
}
