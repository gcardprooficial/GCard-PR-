import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReviewLinkPicker } from "@/components/ReviewLinkPicker";
import { AuthForm } from "@/components/AuthForm";
import { PlateQrDownload } from "@/components/PlateQrDownload";
import { usePlus } from "@/lib/use-plus";
import { AtivarTabs, ABAS, type Aba } from "@/components/ativar/AtivarTabs";
import { PlusHub } from "@/components/ativar/PlusHub";
import { ToqyStrip } from "@/components/ativar/ToqyStrip";
import { AjudaTab, ContaTab } from "@/components/ativar/AjudaConta";
import { BookOpen, Crown, FileText, LayoutDashboard, LayoutGrid, Moon, Palette, Pencil, Plus, ShoppingBag, Sun, Trash2, User } from "lucide-react";
import { GLogo } from "@/components/site/SiteChrome";
import { useV2Theme } from "@/lib/use-v2-theme";
import { releaseBatch, releasePlate, renameMyBatch } from "@/lib/plates.functions";
import { PlateScanStats } from "@/components/PlateScanStats";
import { checkDestination, isToqyUrl, registerToqyHosts, toqyOnboardingUrl, type DestinationRule } from "@/lib/destination";
import { requestDestinationRelease } from "@/lib/destination.functions";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { untyped } from "@/lib/db-untyped";
import logoTransparente from "@/assets/logo/gcard-pro-logo-transparente.webp";
import logoMarca from "@/assets/logo/header-marca.png";
import logoIcone from "@/assets/logo/header-icone.png";

export const Route = createFileRoute("/ativar")({
  head: () => ({
    meta: [
      { title: "Ativar meus códigos | GCard-PRÓ" },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { aba?: Aba; codigo?: string } => ({
    ...(s["aba"] === "codigos" ? { aba: "placas" as Aba } : ABAS.includes(s["aba"] as Aba) ? { aba: s["aba"] as Aba } : {}),
    ...(typeof s["codigo"] === "string" && /^[0-9a-f-]{36}$/i.test(s["codigo"]) ? { codigo: s["codigo"] } : {}),
  }),
  component: Ativar,
});

type Batch = {
  id: string;
  code: string;
  label: string | null;
  quantity: number;
  codes_sent_at: string | null;
  created_at: string;
  /** Veio de uma compra: o cliente não remove o grupo sozinho (as placas já foram impressas e enviadas). */
  owner_order_id: string | null;
  products: { name: string; has_qr: boolean; has_nfc: boolean } | null;
};
type Plate = {
  id: string;
  token: string;
  short_code: string;
  status: string;
  destination_url: string | null;
  business_name: string | null;
  sold_to: string | null;
  batch_id: string | null;
  last_scan_at: string | null;
  scan_count: number;
  activated_at: string | null;
  tracking_v2: boolean;
  plus_created?: boolean;
  tag?: string | null;
  qr_style?: unknown;
};

function Ativar() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  // O link de "esqueci minha senha" já loga a pessoa sozinho (é assim que o Supabase
  // funciona) -- sem isso, ela caía direto no painel em vez de trocar a senha.
  const [recoveryMode, setRecoveryMode] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!ready)
    return <Center>Carregando…</Center>;
  if (recoveryMode) return <UpdatePassword onDone={() => setRecoveryMode(false)} />;
  if (!session) return <AuthForm redirectPath="/ativar" title="Ativar meus códigos" subtitle="Use o mesmo e-mail que você usou na compra do lote." />;
  return <Lote email={session.user.email ?? ""} userId={session.user.id} />;
}

function UpdatePassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error("Não consegui trocar a senha. Tenta pedir o link de novo.");
      return;
    }
    toast.success("Senha atualizada!");
    onDone();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-5">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl bg-card p-8 card-soft">
        <Link to="/" className="inline-flex items-center">
          <img src={logoTransparente} alt="GCard-PRÓ" className="h-10 w-auto" draggable={false} />
        </Link>
        <h1 className="mt-4 text-xl">Escolha uma nova senha</h1>
        <div className="mt-6">
          <Label htmlFor="np">Nova senha</Label>
          <Input
            id="np"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 h-11"
            minLength={6}
            required
            autoFocus
          />
        </div>
        <Button type="submit" className="mt-6 w-full" disabled={busy}>
          {busy ? "Salvando…" : "Salvar nova senha"}
        </Button>
      </form>
    </div>
  );
}

function Center({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-5 text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function Lote({ email, userId }: { email: string; userId: string }) {
  const plus = usePlus();
  const search = Route.useSearch();
  const aba: Aba = search.aba ?? "inicio";
  const detailId = search.codigo ?? null;
  // Abre o painel Plus de um código (ou volta ao geral com null).
  const goDetail = (id: string | null) => {
    void navigate({ search: { aba: "plus", ...(id ? { codigo: id } : {}) } });
    window.scrollTo({ top: 0 });
  };
  const navigate = Route.useNavigate();
  const { theme, toggle: toggleTheme } = useV2Theme();
  const [isTeamUser, setIsTeamUser] = useState(false);
  useEffect(() => {
    supabase.from("user_roles").select("role").in("role", ["admin", "staff"]).then(({ data }) => setIsTeamUser((data?.length ?? 0) > 0));
  }, [userId]);

  const goAba = (a: Aba) => {
    void navigate({ search: { aba: a } });
    window.scrollTo({ top: 0 });
  };
  // Aba do Plus aparece quando a venda está liberada (ou para a equipe, que enxerga mesmo com a flag desligada).
  const showPlus = plus.enabled;
  const [batches, setBatches] = useState<Batch[] | null>(null);
  const [plates, setPlates] = useState<Plate[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "ativada" | "nao_ativada">("all");
  const [sortBy, setSortBy] = useState<"codigo" | "recentes" | "antigas" | "negocio">("codigo");
  const [redeemCode, setRedeemCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  // Hosts aceitos como destino: lista única do banco (a mesma do /r e do gatilho SQL).
  const [rules, setRules] = useState<DestinationRule[]>([]);
  const [allowedUrls, setAllowedUrls] = useState<string[]>([]);
  // Domínios próprios de bio sites Toqy: a placa mostra "Página TOQY" também para eles. Falha em silêncio se a coluna ainda não existir.
  const [, setToqyHostsLoaded] = useState(false);
  useEffect(() => {
    void untyped(supabase)
      .from("allowed_destination_hosts")
      .select("host")
      .eq("source", "toqy")
      .then(({ data }: { data: { host: string }[] | null }) => {
        registerToqyHosts((data ?? []).map((h) => h.host));
        setToqyHostsLoaded(true);
      });
  }, []);
  // Pedido de liberação: aparece quando o link é válido mas o site ainda não está na lista.
  const [release, setRelease] = useState<{ plate: Plate; url: string; host: string } | null>(null);
  const [asking, setAsking] = useState(false);
  const askRelease = useServerFn(requestDestinationRelease);
  useEffect(() => {
    void untyped(supabase)
      .from("allowed_destination_hosts")
      .select("host, include_subdomains")
      .then(({ data }: { data: DestinationRule[] | null }) => setRules(data ?? []));
    void untyped(supabase)
      .from("allowed_destination_urls")
      .select("url")
      .then(({ data }: { data: { url: string }[] | null }) => setAllowedUrls((data ?? []).map((u) => u.url)));
  }, []);

  async function sendRelease() {
    if (!release) return;
    setAsking(true);
    try {
      const r = await askRelease({ data: { plateId: release.plate.id, url: release.url } });
      if (!r.ok) toast.error(r.error);
      else if (r.status === "ja_liberado") toast.success("Esse endereço já está liberado. Tente salvar de novo.");
      else if (r.status === "ja_pedido") toast.message("Você já pediu liberação desse endereço. Aguarde a nossa resposta.");
      else toast.success("Pedido enviado! Avisamos por e-mail quando for analisado.");
      if (r.ok) setRelease(null);
    } catch {
      toast.error("Não consegui enviar o pedido agora. Tente de novo.");
    } finally {
      setAsking(false);
    }
  }

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      await supabase.rpc("claim_my_batches");
      const b = await supabase
        .from("batches")
        .select("id, code, label, quantity, codes_sent_at, created_at, owner_order_id, products(name, has_qr, has_nfc)")
        .eq("owner_user_id", userId)
        .order("created_at", { ascending: false });
      if (b.error) {
        setLoadError(b.error.message ?? "Não foi possível carregar seus lotes.");
        setBatches([]);
        toast.error(b.error.message ?? "Não foi possível carregar seus lotes.");
        return;
      }
      setBatches((b.data ?? []) as unknown as Batch[]);

      const batchIds = (b.data ?? []).map((x: any) => x.id as string);
      if (batchIds.length === 0) {
        setPlates([]);
        return;
      }
      const p = await supabase
        .from("plates")
        .select(
          "id, token, short_code, status, destination_url, business_name, sold_to, batch_id, last_scan_at, scan_count, activated_at, tracking_v2, plus_created, tag, qr_style",
        )
        .in("batch_id", batchIds)
        .order("short_code", { ascending: true });
      setPlates((p.data ?? []) as unknown as Plate[]);
    } catch (err: any) {
      const msg = err?.message ?? "Erro ao carregar lotes.";
      setLoadError(msg);
      setBatches([]);
      toast.error(msg);
      return;
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function activate(plate: Plate, businessName: string, reviewUrl: string, soldTo: string) {
    const checked = checkDestination(reviewUrl, rules, allowedUrls);
    if (!checked.ok) {
      if (checked.code === "host_nao_permitido" && checked.host && checked.url) {
        setRelease({ plate, url: checked.url, host: checked.host });
        return;
      }
      toast.error(checked.reason);
      return;
    }
    if (checked.upgradedToHttps) toast.message("Trocamos o link para https (mais seguro).");
    const url = checked.url;
    if (businessName.trim().length < 2) {
      toast.error("Informe o nome do negócio.");
      return;
    }
    const { error } = await supabase
      .from("plates")
      .update({
        status: "ativada",
        destination_url: url,
        business_name: businessName.trim(),
        sold_to: soldTo.trim() || null,
        activated_at: new Date().toISOString(),
        activated_by: userId,
      })
      .eq("id", plate.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Código ${plate.short_code} ativado.`);
    void load();
  }

  async function redeem(e: FormEvent) {
    e.preventDefault();
    const code = redeemCode.trim();
    if (!code) return;
    setRedeeming(true);
    const { error } = await supabase.rpc("claim_batch_by_code", { _code: code });
    setRedeeming(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Lote ${code} resgatado!`);
    setRedeemCode("");
    void load();
  }

  async function deactivate(plate: Plate) {
    const { error } = await supabase
      .from("plates")
      .update({ status: "nao_ativada", destination_url: null })
      .eq("id", plate.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void load();
  }

  const counts = useMemo(() => {
    const total = plates.length;
    const active = plates.filter((p) => p.status === "ativada").length;
    return { total, active, blank: total - active };
  }, [plates]);

  const byDate = (a: Plate, b: Plate, dir: 1 | -1) => {
    // Quem ainda não foi ativado vai sempre pro fim, em qualquer sentido.
    if (!a.activated_at && !b.activated_at) return a.short_code.localeCompare(b.short_code);
    if (!a.activated_at) return 1;
    if (!b.activated_at) return -1;
    return (new Date(a.activated_at).getTime() - new Date(b.activated_at).getTime()) * dir;
  };
  const sortedPlates = [...plates].sort((a, b) => {
    if (sortBy === "recentes") return byDate(a, b, -1);
    if (sortBy === "antigas") return byDate(a, b, 1);
    if (sortBy === "negocio") return (a.business_name ?? "￿").localeCompare(b.business_name ?? "￿", "pt-BR");
    return a.short_code.localeCompare(b.short_code);
  });

  const filtered = sortedPlates.filter((p) => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (!q.trim()) return true;
    const t = q.toLowerCase();
    return (
      p.short_code.toLowerCase().includes(t) ||
      p.token.toLowerCase().includes(t) ||
      p.business_name?.toLowerCase().includes(t) ||
      p.sold_to?.toLowerCase().includes(t)
    );
  });

  const isFiltering = q.trim() !== "" || statusFilter !== "all";

  const batchNumberById = useMemo(() => {
    const sorted = [...(batches ?? [])].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    const map = new Map<string, number>();
    sorted.forEach((b, i) => map.set(b.id, i + 1));
    return map;
  }, [batches]);

  const platesByBatch = useMemo(() => {
    const map = new Map<string, Plate[]>();
    for (const p of filtered) {
      const key = p.batch_id ?? "sem-lote";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return map;
  }, [filtered]);

  const runRelease = useServerFn(releasePlate);
  const runRename = useServerFn(renameMyBatch);
  const runReleaseBatch = useServerFn(releaseBatch);

  async function removeBatch(b: Batch, count: number) {
    const ok = window.confirm(
      count === 0
        ? "Remover este grupo vazio da sua conta?"
        : `Remover este grupo e os ${count} código(s) dele da sua conta?\n\n` +
            "• Os que vieram da GCard voltam limpos ao estoque e podem ir para outra pessoa.\n" +
            "• Os QR que você criou no Plus são apagados.\n" +
            "• Links, nomes e leituras somem. Placas já impressas com esses códigos param de funcionar.",
    );
    if (!ok) return;
    try {
      const r = await runReleaseBatch({ data: { batchId: b.id } });
      toast.success(r.devolvidas + r.apagados === 0 ? "Grupo removido." : `Grupo removido: ${r.devolvidas} devolvido(s) ao estoque, ${r.apagados} QR apagado(s).`);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível remover agora.");
    }
  }

  async function removePlate(plate: Plate) {
    const ok = window.confirm(
      `Remover o código ${plate.short_code} da sua conta?\n\n` +
        "• Se ele veio da GCard, volta limpo para o estoque e pode ir para outra pessoa.\n" +
        "• Se foi um QR que você criou no Plus, ele é apagado.\n" +
        "• O link, o nome e as leituras deste código somem. Uma placa já impressa com ele para de funcionar.",
    );
    if (!ok) return;
    try {
      const r = await runRelease({ data: { plateId: plate.id } });
      toast.success(r.apagado ? `QR ${plate.short_code} apagado.` : `Código ${plate.short_code} devolvido ao estoque da GCard.`);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível remover agora.");
    }
  }

  async function renameBatch(b: Batch) {
    const label = window.prompt("Nome deste grupo de códigos (ex.: Cartões da Barbearia):", b.label ?? "");
    if (label === null) return;
    try {
      await runRename({ data: { batchId: b.id, label } });
      toast.success("Nome salvo.");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar o nome.");
    }
  }

  if (batches === null) return <Center>Carregando…</Center>;

  return (
    <div id="topo" className="v2 gpanel">
      <div className="app">
        <aside className="side">
          <div className="brand"><GLogo size={20} /></div>
          <div className="psw" role="tablist" aria-label="Área">
            <button role="tab" aria-selected className="on">Revendedor</button>
            {isTeamUser ? <Link to="/painel/visao-geral" role="tab" aria-selected={false} style={{ flex: 1, textAlign: "center", padding: "7px 8px", fontSize: 13, fontWeight: 600, color: "var(--muted)", textDecoration: "none" }}>Administração</Link> : null}
          </div>
          <button type="button" className={`nav ${aba === "inicio" ? "on" : ""}`} onClick={() => goAba("inicio")}><LayoutDashboard size={18} /> Início</button>
          <button type="button" className={`nav ${aba === "placas" ? "on" : ""}`} onClick={() => goAba("placas")}><LayoutGrid size={18} /> Minhas placas</button>
          <Link to="/produtos" className="nav"><ShoppingBag size={18} /> Comprar</Link>
          <Link to="/personalizar" className="nav"><Palette size={18} /> Personalizar</Link>
          {showPlus && <button type="button" className={`nav plus ${aba === "plus" ? "on" : ""}`} onClick={() => goAba("plus")}><Crown size={18} /> GCard Plus <span className="plustag">Plus</span></button>}
          <button type="button" className={`nav ${aba === "relatorios" ? "on" : ""}`} onClick={() => goAba("relatorios")}><FileText size={18} /> Relatórios</button>
          <button type="button" className={`nav ${aba === "ajuda" ? "on" : ""}`} onClick={() => goAba("ajuda")}><BookOpen size={18} /> Ajuda</button>
          <button type="button" className={`nav ${aba === "conta" ? "on" : ""}`} onClick={() => goAba("conta")}><User size={18} /> Conta</button>
          <div style={{ marginTop: "auto" }} className="col">
            <span className="badge green">Conta de revendedor</span>
            <span className="xs muted" title={email} style={{ padding: "0 4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</span>
            <button type="button" className="nav" onClick={toggleTheme}>{theme === "light" ? <Moon size={18} /> : <Sun size={18} />} {theme === "light" ? "Modo escuro" : "Modo claro"}</button>
            <button type="button" className="nav" onClick={() => supabase.auth.signOut()}>Sair</button>
          </div>
        </aside>

        <main className="main">
          <div className="topwash" />
          <div className="frame">
          <div>
        {aba === "plus" && showPlus && (
          <PlusHub plates={plates} rules={rules} allowedUrls={allowedUrls} active={plus.active} sub={plus.sub} onDone={() => void load()} onRemove={(p) => void removePlate(p as Plate)} detailId={detailId} onDetail={goDetail} />
        )}
        {aba === "ajuda" && <><PageHead title="Ajuda" sub="Guias rápidos e atendimento." /><AjudaTab /></>}
        {aba === "conta" && <><PageHead title="Conta" /><ContaTab email={email} onSignOut={() => supabase.auth.signOut()} /></>}
        {aba === "inicio" && (
          <InicioTab
            batches={batches.length}
            counts={counts}
            reads={plates.reduce((n, p) => n + (p.scan_count ?? 0), 0)}
            blanks={plates.filter((p) => p.status !== "ativada").slice(0, 3)}
            batchLabel={(id) => (id ? `Lote ${batchNumberById.get(id) ?? ""}` : "")}
            redeemCode={redeemCode}
            setRedeemCode={setRedeemCode}
            redeeming={redeeming}
            onRedeem={redeem}
            onGoPlacas={(f) => { setStatusFilter(f); goAba("placas"); }}
            loadError={loadError}
            onRetry={() => void load()}
          />
        )}
        {aba === "relatorios" && (
          <RelatoriosTab plates={plates.filter((p) => p.status === "ativada")} plusActive={plus.active} plusEnabled={showPlus} onOpen={(id) => goDetail(id)} onPlus={() => goAba("plus")} />
        )}
        {(aba === "placas" || (aba === "plus" && !showPlus)) && (
        <>
        <PageHead title="Minhas placas" sub="Ative, troque o destino e baixe o QR. O destino vale na hora, sem reimprimir." />

        {batches.length === 0 ? (
          <div className="card col">
            <h2>Nenhum lote vinculado</h2>
            <p className="sm muted">
              Não encontramos nenhum lote no e-mail <b>{email}</b>. Use o mesmo e-mail da compra, resgate pelo código na tela Início ou fale com a GCard-PRÓ pelo Instagram{" "}
              <a style={{ textDecoration: "underline" }} href="https://instagram.com/gcardpro.oficial" target="_blank" rel="noopener noreferrer">@gcardpro.oficial</a>.
            </p>
            <button type="button" className="btn primary" style={{ alignSelf: "flex-start" }} onClick={() => goAba("inicio")}>Resgatar um lote</button>
          </div>
        ) : (
          <>
            <div id="placas" className="col scroll-mt-24" style={{ gap: 10 }}>
              <div className="seg">
                {(
                  [
                    ["all", `Todas · ${counts.total}`],
                    ["ativada", `Ativas · ${counts.active}`],
                    ["nao_ativada", `Em branco · ${counts.blank}`],
                  ] as const
                ).map(([k, label]) => (
                  <button key={k} type="button" onClick={() => setStatusFilter(k)} className={`chip ${statusFilter === k ? "on" : ""}`}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="row wrap" style={{ gap: 8 }}>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar código ou negócio" className="input" style={{ flex: "1 1 220px", width: "auto" }} />
                <select
                  aria-label="Ordenar por"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="input"
                  style={{ flex: "0 1 230px", width: "auto" }}
                >
                  <option value="codigo">Ordenar: código</option>
                  <option value="recentes">Ativadas há menos tempo</option>
                  <option value="antigas">Ativadas há mais tempo</option>
                  <option value="negocio">Nome do negócio (A–Z)</option>
                </select>
              </div>
            </div>

            <div className="mt-3 space-y-3">
              {batches.map((b) => {
                const batchPlates = platesByBatch.get(b.id) ?? [];
                if (batchPlates.length === 0 && isFiltering) return null;
                return (
                  <BatchSection
                    key={b.id}
                    batch={b}
                    number={batchNumberById.get(b.id) ?? 0}
                    plates={batchPlates}
                    forceOpen={isFiltering}
                    onActivate={activate}
                    onDeactivate={deactivate}
                    onRelease={removePlate}
                    onRename={renameBatch}
                    onRemoveBatch={removeBatch}
                    plusActive={plus.active}
                    plusEnabled={showPlus}
                    onOpenPlus={(id) => (plus.active ? goDetail(id) : goAba("plus"))}
                  />
                );
              })}
            </div>
          </>
        )}
        </>
        )}

      <Dialog open={release !== null} onOpenChange={(o) => !o && setRelease(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Esse site ainda não está liberado</DialogTitle>
            <DialogDescription>
              O endereço <strong>{release?.host}</strong> ainda não está na nossa lista de sites aceitos nos códigos. Hoje aceitamos Google, WhatsApp,
              Instagram, Facebook, TikTok, YouTube, Linktree, iFood e TOQY. Se o seu é outro, peça a liberação: a gente analisa e avisa por e-mail.
              Enquanto isso, o código continua como está.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            <Button onClick={sendRelease} disabled={asking}>{asking ? "Enviando…" : "Pedir liberação"}</Button>
            <Button variant="outline" onClick={() => setRelease(null)}>Cancelar</Button>
          </div>
        </DialogContent>
      </Dialog>

                </div>
          </div>
        </main>

        <nav className="tabbar" aria-label="Painel">
          <button type="button" className={`tab ${aba === "inicio" ? "on" : ""}`} onClick={() => goAba("inicio")}><LayoutDashboard size={20} />Início</button>
          <button type="button" className={`tab ${aba === "placas" ? "on" : ""}`} onClick={() => goAba("placas")}><LayoutGrid size={20} />Placas</button>
          <Link to="/produtos" className="tab"><ShoppingBag size={20} />Comprar</Link>
          {showPlus ? <button type="button" className={`tab ${aba === "plus" ? "on" : ""}`} onClick={() => goAba("plus")}><Crown size={20} />Plus</button> : <button type="button" className={`tab ${aba === "ajuda" ? "on" : ""}`} onClick={() => goAba("ajuda")}><BookOpen size={20} />Ajuda</button>}
          <button type="button" className={`tab ${aba === "conta" ? "on" : ""}`} onClick={() => goAba("conta")}><User size={20} />Conta</button>
        </nav>
      </div>
    </div>
  );
}

const PAGE_SIZE = 15;

function BatchSection({
  batch,
  number,
  plates,
  forceOpen,
  onActivate,
  onDeactivate,
  onRelease,
  onRename,
  onRemoveBatch,
  plusActive,
  plusEnabled,
  onOpenPlus,
}: {
  batch: Batch | null;
  number: number;
  plates: Plate[];
  forceOpen: boolean;
  onActivate: (p: Plate, name: string, url: string, soldTo: string) => void;
  onDeactivate: (p: Plate) => void;
  onRelease: (p: Plate) => void;
  onRename: (b: Batch) => void;
  onRemoveBatch: (b: Batch, count: number) => void;
  plusActive: boolean;
  plusEnabled: boolean;
  onOpenPlus: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [plates]);

  const isOpen = open || forceOpen;
  const activeCount = plates.filter((p) => p.status === "ativada").length;
  const totalPages = Math.max(1, Math.ceil(plates.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pagePlates = plates.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  void number;
  const title = batch
    ? batch.label?.trim() || `Compra de ${new Date(batch.created_at).toLocaleDateString("pt-BR")}`
    : "Cartões avulsos";
  const subtitle = batch ? `${batch.products?.name ?? "Cartão de bolso"} · ${batch.quantity} un.` : "Cartões avulsos";

  return (
    <div className="rounded-2xl bg-card card-soft border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left active:bg-muted/60"
      >
        <div className="min-w-0">
          <p className="font-display text-base font-bold">{title}</p>
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          <p className="mt-0.5 text-xs font-semibold text-primary-foreground sm:hidden">
            {isOpen ? "Toque para fechar" : "Toque para ver as placas"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden text-xs font-semibold text-muted-foreground sm:inline">
            {activeCount}/{plates.length} ativados
          </span>
          <span
            className={`flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-lg font-bold text-primary-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
            aria-hidden
          >
            ▾
          </span>
        </div>
      </button>
      <p className="px-4 pb-2 text-xs font-semibold text-muted-foreground sm:hidden">
        {activeCount}/{plates.length} ativados
      </p>

      {isOpen && (
        <div className="border-t border-border p-4 pt-3 space-y-3">
          {batch && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button type="button" onClick={() => onRename(batch)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
                <Pencil className="size-3.5" /> Dar um nome a este grupo
              </button>
              {!batch.owner_order_id && (
                <button type="button" onClick={() => onRemoveBatch(batch, plates.length)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-destructive hover:underline">
                  <Trash2 className="size-3.5" /> Remover este grupo
                </button>
              )}
            </div>
          )}
          {pagePlates.map((p) => (
            <PlateCard key={p.id} plate={p} onActivate={onActivate} onDeactivate={onDeactivate} onRelease={onRelease} plusActive={plusActive} plusEnabled={plusEnabled} onOpenPlus={onOpenPlus} />
          ))}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-1 text-xs font-semibold">
              <Button size="sm" variant="outline" disabled={pageSafe <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg h-7 px-3">
                ← Anterior
              </Button>
              <span className="text-muted-foreground">Página {pageSafe} de {totalPages}</span>
              <Button size="sm" variant="outline" disabled={pageSafe >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg h-7 px-3">
                Próxima →
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PlateCard({
  plate,
  onActivate,
  onDeactivate,
  onRelease,
  plusActive,
  plusEnabled,
  onOpenPlus,
}: {
  plate: Plate;
  plusActive: boolean;
  plusEnabled: boolean;
  onOpenPlus: (id: string) => void;
  onActivate: (p: Plate, name: string, url: string, soldTo: string) => void;
  onDeactivate: (p: Plate) => void;
  onRelease: (p: Plate) => void;
}) {
  const [name, setName] = useState(plate.business_name ?? "");
  const [url, setUrl] = useState(plate.destination_url ?? "");
  const [soldTo, setSoldTo] = useState(plate.sold_to ?? "");
  const [picking, setPicking] = useState(false);
  const active = plate.status === "ativada";
  const origin = typeof window !== "undefined" ? window.location.origin : "https://gcardpro.com.br";
  const dynamicUrl = `${origin}/r/${plate.token}`;
  // Chips de códigos novos levam ?s=n (origem NFC); códigos antigos continuam sem parâmetro.
  const nfcUrl = plate.tracking_v2 ? `${dynamicUrl}?s=n` : dynamicUrl;
  const toqy = isToqyUrl(plate.destination_url);

  function copyDynamicUrl() {
    navigator.clipboard.writeText(nfcUrl);
    toast.success("Link do cartão copiado! Cole no NFC Tools.");
  }

  return (
    <div className="rounded-2xl bg-card p-5 card-soft border border-border">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-base font-black tracking-wide bg-surface px-3 py-1.5 rounded-lg border-2 border-primary/30 text-foreground">
            {plate.short_code}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={copyDynamicUrl}
            className="h-7 text-xs rounded-lg px-2.5 border-dashed"
            title="Copiar URL para gravar no chip NFC com NFC Tools"
          >
            📋 Copiar URL NFC
          </Button>
        </div>
        <span
          className={`rounded-full px-3 py-0.5 text-xs font-bold ${
            active ? "bg-green-100 text-green-800 border border-green-200" : "bg-amber-100 text-amber-900 border border-amber-200"
          }`}
        >
          {active ? (toqy ? "✓ Página TOQY" : "✓ Ativado no Google") : "○ Em branco (Sem loja)"}
        </span>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        {plate.scan_count} toque(s) / leitura(s) de pessoas
        {active && plate.activated_at ? ` · ativado em ${new Date(plate.activated_at).toLocaleDateString("pt-BR")}` : ""}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs font-semibold">Nome deste código (o que ele é)</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Barbearia Silva, Cardápio, Meu Instagram"
            className="mt-1 h-10 input-soft rounded-xl"
          />
        </div>
        <div>
          <Label className="text-xs font-semibold">Cliente / quem comprou de você (opcional)</Label>
          <Input
            value={soldTo}
            onChange={(e) => setSoldTo(e.target.value)}
            placeholder="Ex: Marcos (11) 99999-9999"
            className="mt-1 h-10 input-soft rounded-xl"
          />
        </div>
        <div className="sm:col-span-2">
          <Label className="text-xs font-semibold">Link de destino (qualquer link https)</Label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://... (avaliação do Google, página do TOQY, Instagram, site…)"
            className="mt-1 h-10 input-soft rounded-xl"
          />
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="mt-2 inline-flex h-10 items-center gap-2 rounded-xl border-2 border-primary bg-primary/10 px-4 text-sm font-bold text-foreground hover:bg-primary/20"
          >
            🔎 Não tem o link? Buscar pelo nome do negócio
          </button>
          {toqy && <p className="mt-2 text-xs text-green-700">Sua placa já leva para a sua página TOQY.</p>}
          <ReviewLinkPicker
            open={picking}
            onOpenChange={setPicking}
            initialTerm={name}
            onPick={(r) => {
              setUrl(r.reviewUrl);
              if (!name.trim()) setName(r.name);
              toast.success("Link preenchido. Clique em Ativar para salvar.");
            }}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => onActivate(plate, name, url, soldTo)} className="rounded-xl font-bold">
          {active ? "Salvar alterações" : "Ativar cartão"}
        </Button>
        {active && (
          <>
            <Button size="sm" variant="outline" asChild className="rounded-xl">
              <a href={dynamicUrl} target="_blank" rel="noopener noreferrer">
                Testar link ↗
              </a>
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onDeactivate(plate)} className="text-muted-foreground hover:text-destructive text-xs">
              Desativar
            </Button>
          </>
        )}
        <Button size="sm" variant="ghost" onClick={() => onRelease(plate)} className="ml-auto gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive">
          <Trash2 className="size-3.5" /> Remover
        </Button>
      </div>
      <PlateQrDownload plateId={plate.id} />
      <PlateScanStats
        plateId={plate.id}
        extra={
          plusEnabled ? (
            <button
              type="button"
              onClick={() => onOpenPlus(plate.id)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-secondary px-3 text-xs font-bold text-secondary-foreground hover:opacity-90"
            >
              <Crown className="size-3.5 text-primary" /> {plusActive ? "Ver painel Plus" : "Conhecer o GCard Plus"}
            </button>
          ) : null
        }
      />
      {!toqy && <ToqyStrip href={toqyOnboardingUrl(plate.short_code)} />}
    </div>
  );
}

/** Cabeçalho de cada tela, igual ao do protótipo. */
function PageHead({ title, eyebrow, sub }: { title: ReactNode; eyebrow?: string; sub?: ReactNode }) {
  return (
    <div className="mb">
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <h1>{title}</h1>
      {sub && <p className="muted sm" style={{ marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

/** Início: o que falta ativar, números e o resgate de um lote novo. Tudo curto, sem listas longas. */
function InicioTab(props: {
  batches: number;
  counts: { total: number; active: number; blank: number };
  reads: number;
  blanks: Plate[];
  batchLabel: (id: string | null) => string;
  redeemCode: string;
  setRedeemCode: (v: string) => void;
  redeeming: boolean;
  onRedeem: (e: FormEvent) => void;
  onGoPlacas: (f: "all" | "ativada" | "nao_ativada") => void;
  loadError: string | null;
  onRetry: () => void;
}) {
  const { counts } = props;
  return (
    <>
      <PageHead title="Olá" eyebrow="Resumo" sub="Suas placas e o que falta ativar." />
      <div className="col" style={{ gap: 14 }}>
        {props.loadError && (
          <div className="card col">
            <h2>Não foi possível carregar os lotes</h2>
            <p className="sm muted">{props.loadError}</p>
            <button type="button" className="btn primary" style={{ alignSelf: "flex-start" }} onClick={props.onRetry}>Tentar novamente</button>
          </div>
        )}
        <div className="metrics">
          <div className="metric"><div className="xs muted">Placas ativas</div><div className="v">{counts.active}</div></div>
          <div className={`metric ${counts.blank ? "warn" : ""}`}><div className="xs muted">Falta ativar</div><div className="v">{counts.blank}</div></div>
          <div className="metric"><div className="xs muted">Lotes</div><div className="v">{props.batches}</div></div>
          <div className="metric"><div className="xs muted">Leituras</div><div className="v">{props.reads}</div></div>
        </div>
        {counts.blank > 0 && (
          <div className="card col">
            <h2>Placas em branco</h2>
            <p className="sm muted">Cada placa só começa a funcionar depois de ativada com o link do cliente.</p>
            {props.blanks.map((p) => (
              <div key={p.id} className="row">
                <b className="grow">{p.short_code}</b>
                <span className="xs muted">{props.batchLabel(p.batch_id)}</span>
              </div>
            ))}
            <button type="button" className="btn primary" style={{ alignSelf: "flex-start" }} onClick={() => props.onGoPlacas("nao_ativada")}>Ativar agora</button>
          </div>
        )}
        <form id="resgatar" onSubmit={props.onRedeem} className="card col scroll-mt-24">
          <b>Recebeu um lote novo?</b>
          <span className="sm muted">Resgate pelo código que veio com o pedido.</span>
          <div className="row wrap" style={{ gap: 8 }}>
            <input value={props.redeemCode} onChange={(e) => props.setRedeemCode(e.target.value)} placeholder="Ex.: L-260915-AB12CD" className="input" style={{ flex: "1 1 220px", width: "auto", fontFamily: "monospace" }} />
            <button type="submit" className="btn primary" disabled={props.redeeming || !props.redeemCode.trim()}>{props.redeeming ? "Resgatando…" : "Resgatar lote"}</button>
          </div>
        </form>
        <div className="card row wrap" style={{ gap: 12 }}>
          <div className="grow"><b>Precisa de mais placas?</b><div className="sm muted">Revenda a partir de 10 unidades, frete grátis.</div></div>
          <Link to="/produtos" className="btn">Comprar</Link>
        </div>
      </div>
    </>
  );
}

/** Relatórios: cada placa ativa abre o link e o PDF para o cliente (recurso do Plus). */
function RelatoriosTab({ plates, plusActive, plusEnabled, onOpen, onPlus }: { plates: Plate[]; plusActive: boolean; plusEnabled: boolean; onOpen: (id: string) => void; onPlus: () => void }) {
  return (
    <>
      <PageHead title="Relatórios" sub="Um link e um PDF por cliente, para você mostrar quantas pessoas leram a placa." />
      <div className="col" style={{ gap: 10 }}>
        {!plusActive && (
          <div className="card goldframe row wrap" style={{ gap: 10 }}>
            <span className="plustag">Plus</span>
            <span className="sm grow">Relatório para o cliente é um recurso do GCard Plus.</span>
            {plusEnabled && <button type="button" className="btn goldbtn" onClick={onPlus}>Conhecer o Plus</button>}
          </div>
        )}
        {plates.length === 0 && <div className="card panel center sm muted" style={{ padding: 22 }}>Nenhuma placa ativa ainda. Ative uma placa para gerar o relatório dela.</div>}
        {plates.map((p) => (
          <div key={p.id} className="card row wrap" style={{ gap: 10 }}>
            <div className="grow"><b>{p.business_name || p.short_code}</b><div className="sm muted">{p.short_code} · {p.scan_count} leituras</div></div>
            <button type="button" className="btn" disabled={!plusActive} onClick={() => onOpen(p.id)}>Abrir relatório</button>
          </div>
        ))}
      </div>
    </>
  );
}
