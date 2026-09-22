import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { searchBusinesses, type BusinessResult } from "@/lib/places.functions";
import { submitToolLead } from "@/lib/leads.functions";
import { WHATSAPP_CONTACTS, whatsappLink } from "@/lib/contact";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Ferramenta grátis: acha o negócio no Google pelo nome e entrega o link de avaliação. */
export function ReviewLinkGenerator() {
  const runSearch = useServerFn(searchBusinesses);
  const runSubmitLead = useServerFn(submitToolLead);
  const [term, setTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BusinessResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  // Negócio da última cópia: usa pra oferecer contato sem pedir pra escolher de novo.
  const [leadBusiness, setLeadBusiness] = useState<{ name: string; placeId: string } | null>(null);
  const [leadWhatsapp, setLeadWhatsapp] = useState("");
  const [leadSending, setLeadSending] = useState(false);
  const [leadSent, setLeadSent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (term.trim().length < 3) {
      setError("Digite pelo menos 3 letras do nome do negócio.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await runSearch({ data: { query: term.trim() } });
      if (!res.ok) {
        setResults(null);
        setError(res.error);
      } else {
        setResults(res.results);
      }
    } catch {
      setResults(null);
      setError("Não conseguimos buscar agora. Tente de novo em instantes.");
    } finally {
      setLoading(false);
    }
  }

  async function copy(r: BusinessResult) {
    const ok = await copyText(r.reviewUrl);
    if (ok) {
      setCopied(r.placeId);
      toast.success("Link copiado!");
      setTimeout(() => setCopied((cur) => (cur === r.placeId ? null : cur)), 2500);
    } else {
      toast.error("Não consegui copiar. Selecione o link e copie manualmente.");
    }
    // Copiou = já vai usar o link -- momento certo de oferecer o cartão físico.
    setLeadBusiness({ name: r.name, placeId: r.placeId });
    setLeadSent(false);
  }

  async function sendLead(e: FormEvent) {
    e.preventDefault();
    if (!leadBusiness) return;
    setLeadSending(true);
    try {
      const res = await runSubmitLead({
        data: {
          businessName: leadBusiness.name,
          placeId: leadBusiness.placeId,
          whatsapp: leadWhatsapp.trim() || null,
        },
      });
      if (res.ok) {
        setLeadSent(true);
        toast.success("Recebido! A gente te chama no WhatsApp.");
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Não consegui enviar. Chame no WhatsApp direto.");
    } finally {
      setLeadSending(false);
    }
  }

  return (
    <section id="gerar-link" className="mx-auto max-w-4xl scroll-mt-20 px-5 py-14 md:py-16">
      <div className="rounded-[2rem] border border-border bg-card p-6 card-soft sm:p-10">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Ferramenta grátis</p>
        <h2 className="mt-3 text-3xl leading-tight sm:text-4xl">
          Gere o <span className="highlight-yellow">link de avaliação</span> do seu negócio.
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Digite o nome da empresa como aparece no Google, escolha o resultado e copie o link que abre
          direto a tela de avaliação. Sem cadastro.
        </p>

        <form onSubmit={submit} className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Ex.: Barbearia do João, Centro, Campinas"
            className="h-12 flex-1 rounded-2xl text-base"
            aria-label="Nome do negócio"
          />
          <Button
            type="submit"
            disabled={loading}
            className="btn-press btn-primary-shadow h-12 rounded-2xl px-6 text-base font-bold"
            data-analytics-event="gerar_link_buscar"
          >
            {loading ? "Buscando…" : "Buscar meu negócio"}
          </Button>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">
          Dica: inclua a cidade ou o bairro para achar mais rápido.
        </p>

        {error && (
          <div role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <p className="font-semibold">{error}</p>
            <p className="mt-1">
              Se continuar, chame a gente no{" "}
              <a
                className="font-bold underline"
                href={whatsappLink(WHATSAPP_CONTACTS[0].number, "Oi! Não consegui gerar o link de avaliação no site.")}
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp
              </a>{" "}
              que a gente gera pra você.
            </p>
          </div>
        )}

        {results && results.length === 0 && (
          <p className="mt-5 rounded-2xl bg-muted p-4 text-sm text-muted-foreground">
            Nenhum negócio encontrado. Tente o nome completo com a cidade.
          </p>
        )}

        {results && results.length > 0 && (
          <ul className="mt-6 space-y-3">
            {results.map((r) => (
              <li key={r.placeId} className="rounded-2xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold">{r.name}</p>
                    <p className="text-sm text-muted-foreground">{r.address}</p>
                    {r.rating !== null && (
                      <p className="mt-1 text-xs font-semibold text-foreground/70">
                        ★ {r.rating.toFixed(1)}
                        {r.reviews !== null ? ` · ${r.reviews} avaliações` : ""}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      onClick={() => void copy(r)}
                      className="rounded-xl"
                      data-analytics-event="gerar_link_copiar"
                    >
                      {copied === r.placeId ? "Copiado ✓" : "Copiar link"}
                    </Button>
                    <Button asChild size="sm" variant="outline" className="rounded-xl">
                      <a href={r.reviewUrl} target="_blank" rel="noopener noreferrer">
                        Testar
                      </a>
                    </Button>
                  </div>
                </div>
                <input
                  readOnly
                  value={r.reviewUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  aria-label={`Link de avaliação de ${r.name}`}
                  className="mt-3 w-full rounded-lg bg-muted px-3 py-2 font-mono text-xs text-muted-foreground"
                />
              </li>
            ))}
          </ul>
        )}

        {results && results.length > 0 && (
          <div className="mt-6 rounded-2xl bg-primary/15 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold">
                Quer esse link num cartão NFC ou placa pro seu balcão? A gente entrega pronto.
              </p>
              <Button asChild size="sm" className="rounded-xl">
                <Link to="/comprar" search={{ caminho: "lojista" }}>
                  Quero o meu →
                </Link>
              </Button>
            </div>

            {leadBusiness && !leadSent && (
              <form
                onSubmit={sendLead}
                className="mt-4 flex flex-col gap-2 border-t border-primary/20 pt-4 sm:flex-row sm:items-center"
              >
                <p className="text-xs text-foreground/80 sm:hidden">
                  Ou deixa seu WhatsApp que a gente te chama com uma condição:
                </p>
                <Input
                  value={leadWhatsapp}
                  onChange={(e) => setLeadWhatsapp(e.target.value)}
                  placeholder="Seu WhatsApp (com DDD)"
                  className="h-10 flex-1 rounded-xl bg-background text-sm"
                  aria-label="Seu WhatsApp"
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  disabled={leadSending}
                  className="h-10 shrink-0 rounded-xl bg-background"
                  data-analytics-event="gerar_link_lead"
                >
                  {leadSending ? "Enviando…" : "Me chama no WhatsApp"}
                </Button>
              </form>
            )}
            {leadSent && (
              <p className="mt-4 border-t border-primary/20 pt-4 text-sm font-semibold text-foreground/80">
                Recebido! A gente te chama no WhatsApp em breve. ✓
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
