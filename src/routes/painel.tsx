import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Package,
  Users,
  Boxes,
  Wallet,
  Calculator,
  CreditCard,
  ScanLine,
  Menu,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PanelCtx } from "@/lib/panelContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import logoIconBranco from "@/assets/logo/Icone_G_Logo_512x512_Branco.png";
import logoTransparente from "@/assets/logo/gcard-pro-logo-transparente.webp";

export const Route = createFileRoute("/painel")({
  head: () => ({ meta: [{ title: "Painel | GCard-PRÓ" }, { name: "robots", content: "noindex" }] }),
  component: PanelLayout,
});

const TABS = [
  { to: "/painel/visao-geral", label: "Visão geral", icon: LayoutDashboard },
  { to: "/painel", label: "Pedidos", exact: true, icon: Package },
  { to: "/painel/clientes", label: "Clientes", icon: Users },
  { to: "/painel/lotes", label: "Lotes", icon: Boxes },
  { to: "/painel/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/painel/calculadora", label: "Calculadora", icon: Calculator },
  { to: "/painel/placas", label: "Placas", icon: CreditCard },
  { to: "/painel/scans", label: "Scans", icon: ScanLine },
] as const;

function PanelLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [isTeam, setIsTeam] = useState<boolean | null>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

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

  const sidebar = (
    <>
      <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-[22px]">
        <img src={logoIconBranco} alt="GCard-PRÓ" className="size-7 object-contain" draggable={false} />
        <span className="text-sm font-bold text-white/70">/ painel</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {TABS.map((t) => {
          const active = "exact" in t && t.exact ? pathname === t.to : pathname.startsWith(t.to);
          const Icon = t.icon;
          return (
            <Link
              key={t.to}
              to={t.to}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-3 text-sm font-semibold transition-colors md:py-2.5 ${
                active
                  ? "bg-primary/15 text-primary"
                  : "text-white/70 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon className="size-[18px] shrink-0" />
              {t.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 px-5 py-4">
        <p className="break-all text-xs text-white/50">{session.user.email}</p>
        <Button
          size="sm"
          variant="outline"
          className="mt-2.5 h-9 w-full border-white/15 bg-white/[0.08] text-white hover:bg-white/15 hover:text-white"
          onClick={() => supabase.auth.signOut()}
        >
          Sair
        </Button>
      </div>
    </>
  );

  const current = TABS.find((t) => ("exact" in t && t.exact ? pathname === t.to : pathname.startsWith(t.to)));

  return (
    <div className="flex min-h-screen flex-col bg-surface md:flex-row">
      {/* Celular: barra no topo + menu lateral deslizante */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between bg-foreground px-4 text-white md:hidden">
        <div className="flex items-center gap-2.5">
          <img src={logoIconBranco} alt="GCard-PRÓ" className="size-6 object-contain" draggable={false} />
          <span className="text-sm font-bold">{current?.label ?? "Painel"}</span>
        </div>
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label="Abrir menu"
              className="flex size-10 items-center justify-center rounded-xl hover:bg-white/10"
            >
              <Menu className="size-6" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="flex w-72 flex-col border-0 bg-foreground p-0 text-white">
            <SheetTitle className="sr-only">Menu do painel</SheetTitle>
            {sidebar}
          </SheetContent>
        </Sheet>
      </header>

      {/* Desktop: sidebar fixa */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-foreground text-white md:flex">
        {sidebar}
      </aside>

      <PanelCtx.Provider value={{ userId: session.user.id, email: session.user.email ?? "" }}>
        <main className="min-w-0 flex-1 px-4 pb-24 pt-5 sm:px-6 md:px-9 md:pb-16 md:pt-8">
          <Outlet />
        </main>
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
