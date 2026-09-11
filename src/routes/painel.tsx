import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PanelCtx } from "@/lib/panelContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logoTransparente from "@/assets/logo/gcard-pro-logo-transparente.png";

export const Route = createFileRoute("/painel")({
  head: () => ({ meta: [{ title: "Painel | GCard-PRÓ" }, { name: "robots", content: "noindex" }] }),
  component: PanelLayout,
});

const TABS = [
  { to: "/painel", label: "Pedidos", exact: true },
  { to: "/painel/lotes", label: "Lotes" },
  { to: "/painel/financeiro", label: "Financeiro" },
  { to: "/painel/calculadora", label: "Calculadora" },
  { to: "/painel/placas", label: "Placas" },
  { to: "/painel/scans", label: "Scans" },
] as const;

function PanelLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [isTeam, setIsTeam] = useState<boolean | null>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setIsTeam(null);
      return;
    }
    supabase
      .from("user_roles")
      .select("role")
      .in("role", ["admin", "staff"])
      .then(({ data }) => setIsTeam((data?.length ?? 0) > 0));
  }, [session]);

  if (!ready) return <Shell>Carregando…</Shell>;
  if (!session) return <Login />;
  if (isTeam === null) return <Shell>Verificando acesso…</Shell>;
  if (!isTeam)
    return (
      <Shell>
        <p>Esta conta não tem acesso ao painel.</p>
        <Button variant="outline" className="mt-4" onClick={() => supabase.auth.signOut()}>
          Sair
        </Button>
      </Shell>
    );

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <Link to="/" className="inline-flex items-center gap-3">
            <img src={logoTransparente} alt="GCard-PRÓ" className="h-9 w-auto" draggable={false} />
            <span className="text-muted-foreground">/ painel</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-muted-foreground sm:inline">{session.user.email}</span>
            <Button size="sm" variant="outline" onClick={() => supabase.auth.signOut()}>
              Sair
            </Button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 px-5">
          {TABS.map((t) => {
            const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <PanelCtx.Provider value={{ userId: session.user.id, email: session.user.email ?? "" }}>
        <div className="mx-auto max-w-6xl px-5 py-8">
          <Outlet />
        </div>
      </PanelCtx.Provider>
    </div>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-5">
      <div className="max-w-sm text-center text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast.error("E-mail ou senha inválidos.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-5">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl bg-card p-8 card-soft">
        <Link to="/" className="inline-flex items-center">
          <img src={logoTransparente} alt="GCard-PRÓ" className="h-10 w-auto" draggable={false} />
        </Link>
        <h1 className="mt-4 text-xl">Painel</h1>
        <div className="mt-6 space-y-4">
          <div>
            <Label htmlFor="e">E-mail</Label>
            <Input
              id="e"
              type="email"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              className="mt-1 h-11"
              required
            />
          </div>
          <div>
            <Label htmlFor="p">Senha</Label>
            <Input
              id="p"
              type="password"
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              className="mt-1 h-11"
              required
            />
          </div>
        </div>
        <Button type="submit" className="mt-6 w-full" disabled={busy}>
          {busy ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </div>
  );
}
