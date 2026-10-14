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
      { name: "robots", content: "noindex" },
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
      <AuthForm
        redirectPath="/gerador"
        title="Gerador de link grátis"
        subtitle="Entre ou crie sua conta (leva 1 minuto) para gerar o link de avaliação do Google do seu negócio."
      />
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
