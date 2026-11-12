import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import { ClipboardList, Ellipsis, Factory, LayoutDashboard, Megaphone, MessageCircle, Moon, Plug, ScanLine, ShieldAlert, Sun, Wallet, type LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PanelCtx } from "@/lib/panelContext";
import { Button } from "@/components/ui/button";
import { DomainExpiryBanner } from "@/components/DomainExpiryBanner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { GLogo } from "@/components/site/SiteChrome";
import { useV2Theme } from "@/lib/use-v2-theme";
import logoTransparente from "@/assets/logo/gcard-pro-logo-transparente.webp";

export const Route = createFileRoute("/painel")({
  head: () => ({ meta: [{ title: "Painel | GCard-PRÓ" }, { name: "robots", content: "noindex" }] }),
  component: PanelLayout,
});

// Administração no desenho do protótipo: 9 grupos; as telas parecidas viram abas dentro do grupo.
// Cada aba é uma tela que já existe (nenhum endereço mudou).
type PTab = { to: string; label: string; exact?: boolean };
type PGroup = { key: string; label: string; icon: LucideIcon; tabs: PTab[]; extra?: string[] };

const GROUPS: PGroup[] = [
  { key: "visao", label: "Visão geral", icon: LayoutDashboard, tabs: [{ to: "/painel/visao-geral", label: "Visão geral" }] },
  { key: "vendas", label: "Vendas", icon: ClipboardList, extra: ["/painel/dossie"], tabs: [{ to: "/painel", label: "Pedidos", exact: true }, { to: "/painel/clientes", label: "Clientes" }, { to: "/painel/relatorios", label: "Relatórios" }] },
  { key: "producao", label: "Produção", icon: Factory, tabs: [{ to: "/painel/lotes", label: "Lotes" }, { to: "/painel/placas", label: "Placas" }, { to: "/painel/estoque", label: "Estoque" }, { to: "/painel/frete", label: "Frete por estado" }] },
  { key: "leituras", label: "Leituras", icon: ScanLine, tabs: [{ to: "/painel/scans", label: "Scans" }, { to: "/painel/estatisticas", label: "Estatísticas (Plus)" }] },
  { key: "dinheiro", label: "Dinheiro", icon: Wallet, tabs: [{ to: "/painel/financeiro", label: "Financeiro" }, { to: "/painel/calculadora", label: "Calculadora" }, { to: "/painel/contador", label: "Contador" }, { to: "/painel/conciliacao", label: "Conciliação MP" }] },
  { key: "crescimento", label: "Crescimento", icon: Megaphone, tabs: [{ to: "/painel/afiliados", label: "Afiliados" }] },
  { key: "seguranca", label: "Segurança", icon: ShieldAlert, tabs: [{ to: "/painel/liberacoes", label: "Liberações de destino" }, { to: "/painel/denuncias", label: "Denúncias" }] },
  { key: "atendimento", label: "Atendimento", icon: MessageCircle, tabs: [{ to: "/painel/whatsapp", label: "WhatsApp" }] },
  { key: "sistema", label: "Sistema", icon: Plug, tabs: [{ to: "/painel/integracoes", label: "Integrações" }] },
];

const tabActive = (t: PTab, pathname: string) => (t.exact ? pathname === t.to : pathname === t.to || pathname.startsWith(`${t.to}/`));
const groupOf = (pathname: string) => GROUPS.find((g) => g.tabs.some((t) => tabActive(t, pathname)) || (g.extra ?? []).some((e) => pathname.startsWith(e))) ?? null;

function PanelLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [isTeam, setIsTeam] = useState<boolean | null>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [menuOpen, setMenuOpen] = useState(false);
  const { theme, toggle } = useV2Theme();

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

  const current = groupOf(pathname);
  const nav = (
    <>
      <div className="brand"><GLogo size={20} /></div>
      <div className="psw" role="tablist" aria-label="Área">
        <Link to="/ativar" role="tab" aria-selected={false} style={{ flex: 1, textAlign: "center", padding: "7px 8px", fontSize: 13, fontWeight: 600, color: "var(--muted)", textDecoration: "none" }}>Revendedor</Link>
        <button role="tab" aria-selected className="on">Administração</button>
      </div>
      {GROUPS.map((g) => {
        const Icon = g.icon;
        return (
          <Link key={g.key} to={g.tabs[0]!.to} className={`nav ${current?.key === g.key ? "on" : ""}`} aria-current={current?.key === g.key ? "page" : undefined}>
            <Icon size={18} aria-hidden="true" /> {g.label}
          </Link>
        );
      })}
      <div style={{ marginTop: "auto" }} className="col">
        <span className="badge green">Equipe GCard</span>
        <span className="xs muted" title={session.user.email ?? ""} style={{ padding: "0 4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{session.user.email}</span>
        <button type="button" className="nav" onClick={toggle}>{theme === "light" ? <Moon size={18} /> : <Sun size={18} />} {theme === "light" ? "Modo escuro" : "Modo claro"}</button>
        <button type="button" className="nav" onClick={() => supabase.auth.signOut()}>Sair</button>
      </div>
    </>
  );

  return (
    <div className="v2 gpanel">
      <div className="app">
        <aside className="side">{nav}</aside>
        <PanelCtx.Provider value={{ userId: session.user.id, email: session.user.email ?? "" }}>
          <main className="main">
            <div className="topwash" />
            <div className="frame">
              <DomainExpiryBanner />
              {current && current.tabs.length > 1 && (
                <div className="seg mb">
                  {current.tabs.map((t) => (
                    <Link key={t.to} to={t.to} className={`chip ${tabActive(t, pathname) ? "on" : ""}`}>{t.label}</Link>
                  ))}
                </div>
              )}
              <Outlet />
            </div>
          </main>
        </PanelCtx.Provider>
        <nav className="tabbar" aria-label="Atalhos do painel">
          {GROUPS.slice(0, 3).map((g) => {
            const Icon = g.icon;
            return (
              <Link key={g.key} to={g.tabs[0]!.to} className={`tab ${current?.key === g.key ? "on" : ""}`}><Icon size={20} />{g.label}</Link>
            );
          })}
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <button type="button" className="tab" aria-label="Abrir menu"><Ellipsis size={20} />Mais</button>
            </SheetTrigger>
            <SheetContent side="left" className="flex w-72 flex-col border-0 p-0">
              <SheetTitle className="sr-only">Menu do painel</SheetTitle>
              <div className="v2 gpanel" style={{ display: "contents" }}>
                <div className="side" style={{ display: "flex", height: "100%", position: "static" }}>{nav}</div>
              </div>
            </SheetContent>
          </Sheet>
        </nav>
      </div>
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
