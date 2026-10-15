import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { confirmUnsubscribe, getUnsubscribeInfo } from "@/lib/unsubscribe.functions";

export const Route = createFileRoute("/sair")({
  validateSearch: z.object({ token: z.string().uuid().optional().catch(undefined) }),
  head: () => ({ meta: [{ title: "Deixar de receber e-mails | GCard-PRÓ" }, { name: "robots", content: "noindex" }] }),
  component: Sair,
});

/** Confirmação de descadastro: abrir o link não descadastra; só o botão (POST). Sem login. */
function Sair() {
  const { token } = Route.useSearch();
  const info = useServerFn(getUnsubscribeInfo);
  const confirm = useServerFn(confirmUnsubscribe);
  const [email, setEmail] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "invalid" | "busy" | "done" | "error">("loading");

  useEffect(() => {
    if (!token) {
      setState("invalid");
      return;
    }
    info({ data: { token } })
      .then((r) => {
        if (r.ok) {
          setEmail(r.email);
          setState("ready");
        } else setState("invalid");
      })
      .catch(() => setState("invalid"));
  }, [token, info]);

  async function submit() {
    if (!token) return;
    setState("busy");
    try {
      const r = await confirm({ data: { token } });
      setState(r.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-5">
      <div className="w-full max-w-md rounded-3xl bg-card p-8 text-center card-soft">
        {state === "loading" && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {state === "invalid" && (
          <>
            <h1 className="text-xl">Link inválido</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Esse link de descadastro não é válido. Se precisar, fale com a gente pelo WhatsApp.
            </p>
          </>
        )}
        {(state === "ready" || state === "busy" || state === "error") && (
          <>
            <h1 className="text-xl">Deixar de receber novidades?</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Vamos parar de enviar novidades e ofertas para <strong>{email}</strong>. Avisos do seu pedido continuam chegando.
            </p>
            {state === "error" && <p className="mt-2 text-sm text-red-700">Não consegui concluir agora. Tente de novo.</p>}
            <Button onClick={() => void submit()} disabled={state === "busy"} className="mt-6 w-full">
              {state === "busy" ? "Aguarde…" : "Sim, quero sair da lista"}
            </Button>
            <Button asChild variant="ghost" className="mt-2 w-full">
              <Link to="/">Não, voltar ao site</Link>
            </Button>
          </>
        )}
        {state === "done" && (
          <>
            <h1 className="text-xl">Pronto, você saiu da lista</h1>
            <p className="mt-2 text-sm text-muted-foreground">Não vamos mais enviar novidades e ofertas para o seu e-mail.</p>
            <Button asChild className="mt-6 w-full">
              <Link to="/">Voltar ao site</Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
