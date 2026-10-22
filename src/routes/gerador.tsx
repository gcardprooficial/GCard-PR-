import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { AuthForm } from "@/components/AuthForm";
import { ReviewLinkGenerator } from "@/components/ReviewLinkGenerator";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";

export const Route = createFileRoute("/gerador")({
  head: () => ({
    meta: [
      { title: "Gerador de link de avaliação do Google | GCard-PRÓ" },
      { name: "description", content: "Ferramenta grátis: ache seu negócio no Google e pegue o link de avaliação. Precisa de cadastro." },
      { name: "robots", content: "index,follow" },
    ],
  }),
  component: Gerador,
});

/** Gerador de link grátis: só para quem tem conta (login ou cadastro antes de usar). */
function Gerador() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return <div className="flex min-h-screen items-center justify-center bg-surface text-sm text-muted-foreground">Carregando…</div>;
  }
  if (!session) {
    return (
      <>
        <AuthForm
          redirectPath="/gerador"
          title="Gerador de link grátis"
          subtitle="Entre ou crie sua conta (leva 1 minuto) para gerar o link de avaliação do Google do seu negócio."
        />
        {/* Texto para quem chega pelo Google: a ferramenta fica atrás do cadastro, mas a página explica o que ela faz. */}
        <section className="mx-auto max-w-2xl px-5 pb-16 text-sm leading-relaxed text-muted-foreground">
          <h2 className="font-display text-xl font-bold text-foreground">Como pegar o link de avaliação do Google do seu negócio</h2>
          <p className="mt-3">
            O link de avaliação leva o cliente direto para a tela de dar nota e escrever a avaliação do seu negócio no Google, sem procurar. É o mesmo link que vai na placa ou no cartão do GCard-PRÓ.
          </p>
          <ol className="mt-4 list-decimal space-y-1 pl-5">
            <li>Crie sua conta grátis (leva 1 minuto).</li>
            <li>Busque o seu negócio pelo nome.</li>
            <li>Copie o link de avaliação e use onde quiser: WhatsApp, Instagram, QR Code ou NFC.</li>
          </ol>
          <p className="mt-4">Para o link funcionar, o seu negócio precisa ter o perfil ativo no Google Meu Negócio.</p>
        </section>
      </>
    );
  }
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <ReviewLinkGenerator />
      <SiteFooter />
    </div>
  );
}
