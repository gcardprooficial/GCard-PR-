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
import { BookOpen, Crown, LayoutGrid, Pencil, Plus, Trash2, User } from "lucide-react";
import { releasePlate, renameMyBatch } from "@/lib/plates.functions";
import { PlateScanStats } from "@/components/PlateScanStats";
import { checkDestination, isToqyUrl, toqyOnboardingUrl, type DestinationRule } from "@/lib/destination";
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
    ...(ABAS.includes(s["aba"] as Aba) ? { aba: s["aba"] as Aba } : {}),
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
  const aba: Aba = search.aba ?? "codigos";
  const detailId = search.codigo ?? null;
  // Abre o painel Plus de um código (ou volta ao geral com null).
  const goDetail = (id: string | null) => {
    void navigate({ search: { aba: "plus", ...(id ? { codigo: id } : {}) } });
    window.scrollTo({ top: 0 });
  };
  const navigate = Route.useNavigate();
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
        .select("id, code, label, quantity, codes_sent_at, created_at, products(name, has_qr, has_nfc)")
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
    <div id="topo" className="min-h-screen bg-surface pb-24 md:pb-0">
      <header className="sticky top-0 z-40 bg-foreground text-white">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between gap-3 px-5">
          <Link to="/" className="inline-flex items-center gap-2.5" aria-label="GCard-PRÓ — início">
            <img src={logoIcone} alt="" className="h-9 w-auto" draggable={false} />
            <img src={logoMarca} alt="GCard-PRÓ" className="hidden h-5 w-auto sm:block" draggable={false} />
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-white/60 sm:inline">{email}</span>
            <Button size="sm" variant="outline" className="rounded-xl border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white" onClick={() => supabase.auth.signOut()}>
              Sair
            </Button>
          </div>
        </div>
      </header>
      <AtivarTabs aba={showPlus || aba !== "plus" ? aba : "codigos"} onChange={goAba} showPlus={showPlus} />

      <div className="mx-auto max-w-4xl px-5 py-8">
        {aba === "plus" && showPlus && (
          <PlusHub plates={plates} rules={rules} allowedUrls={allowedUrls} active={plus.active} sub={plus.sub} onDone={() => void load()} onRemove={(p) => void removePlate(p as Plate)} detailId={detailId} onDetail={goDetail} />
        )}
        {aba === "ajuda" && <AjudaTab />}
        {aba === "conta" && <ContaTab email={email} onSignOut={() => supabase.auth.signOut()} />}
        {(aba === "codigos" || (aba === "plus" && !showPlus)) && (
        <>
        <form id="resgatar" onSubmit={redeem} className="scroll-mt-24 rounded-2xl bg-card p-5 card-soft border border-dashed border-primary/40 mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label className="text-xs font-semibold">Recebeu um lote novo? Resgate pelo código</Label>
            <Input
              value={redeemCode}
              onChange={(e) => setRedeemCode(e.target.value)}
              placeholder="Ex: L-260915-AB12CD"
              className="mt-1 h-10 input-soft rounded-xl font-mono"
            />
          </div>
          <Button type="submit" disabled={redeeming || !redeemCode.trim()} className="rounded-xl font-bold">
            {redeeming ? "Resgatando…" : "Resgatar lote"}
          </Button>
        </form>

        {loadError && (
          <div className="rounded-2xl bg-card p-6 card-soft mb-4">
            <h2 className="text-lg text-foreground">Não foi possível carregar lotes</h2>
            <p className="mt-2 text-sm text-muted-foreground">{loadError}</p>
            <div className="mt-4 flex gap-2">
              <Button onClick={() => void load()}>Tentar novamente</Button>
              <Button variant="outline" onClick={() => supabase.auth.signOut()}>
                Sair
              </Button>
            </div>
          </div>
        )}


        {batches.length === 0 ? (
          <div className="rounded-2xl bg-card p-6 card-soft">
            <h1 className="text-xl">Nenhum lote vinculado</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Não encontramos nenhum lote no e-mail <strong>{email}</strong>. Use o mesmo e-mail da
              compra, ou fale com a GCard-PRÓ pelo Instagram{" "}
              <a className="underline" href="https://instagram.com/gcardpro.oficial" target="_blank" rel="noopener noreferrer">
                @gcardpro.oficial
              </a>
              .
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Lotes" value={batches.length} />
              <Stat label="Total de códigos" value={counts.total} />
              <Stat label="Ativados" value={counts.active} />
              <Stat label="Em branco" value={counts.blank} />
            </div>

            <div className="mt-5" />
            <div id="placas" className="mt-5 flex scroll-mt-24 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold">Cartões por lote</h2>
                <p className="text-xs text-muted-foreground">Clique num lote pra abrir e ativar os cartões dele</p>
              </div>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar código / negócio" className="h-10 w-full sm:w-64 input-soft rounded-xl" />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="text-xs font-semibold text-muted-foreground" htmlFor="ordenar-placas">
                Ordenar por
              </label>
              <select
                id="ordenar-placas"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="h-9 rounded-xl border border-border bg-background px-3 text-xs font-semibold"
              >
                <option value="codigo">Código (GCARD-0000)</option>
                <option value="recentes">Ativadas há menos tempo</option>
                <option value="antigas">Ativadas há mais tempo</option>
                <option value="negocio">Nome do negócio (A–Z)</option>
              </select>
            </div>

            <div className="mt-3 flex gap-1 rounded-full bg-muted p-1 text-xs font-semibold">
              {(
                [
                  ["all", `Todos (${counts.total})`],
                  ["ativada", `Ativados (${counts.active})`],
                  ["nao_ativada", `Em branco (${counts.blank})`],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setStatusFilter(k)}
                  className={`rounded-full px-3 py-1.5 transition-colors ${
                    statusFilter === k ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
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
                    plusActive={plus.active}
                    onOpenPlus={goDetail}
                  />
                );
              })}
            </div>
          </>
        )}
        </>
        )}
      </div>

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

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card md:hidden" aria-label="Painel">
        <ul className="mx-auto grid h-16 max-w-md grid-cols-5 items-center text-[11px] font-semibold text-muted-foreground">
          {(
            [
              ["codigos", "Códigos", LayoutGrid],
              ["plus", "Plus", Crown],
            ] as const
          )
            .filter(([k]) => k !== "plus" || showPlus)
            .map(([k, label, Icon]) => (
              <li key={k}>
                <button type="button" onClick={() => goAba(k)} className={`mx-auto flex flex-col items-center gap-0.5 ${aba === k ? "text-foreground" : ""}`}>
                  <Icon className={`size-5 ${k === "plus" ? "text-primary" : ""}`} />
                  {label}
                </button>
              </li>
            ))}
          <li className="flex justify-center">
            <button
              type="button"
              aria-label="Resgatar lote"
              onClick={() => {
                goAba("codigos");
                setTimeout(() => document.getElementById("resgatar")?.scrollIntoView({ behavior: "smooth" }), 80);
              }}
              className="-mt-6 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg"
            >
              <Plus className="size-7" />
            </button>
          </li>
          <li>
            <button type="button" onClick={() => goAba("ajuda")} className={`mx-auto flex flex-col items-center gap-0.5 ${aba === "ajuda" ? "text-foreground" : ""}`}>
              <BookOpen className="size-5" />
              Ajuda
            </button>
          </li>
          <li>
            <button type="button" onClick={() => goAba("conta")} className={`mx-auto flex flex-col items-center gap-0.5 ${aba === "conta" ? "text-foreground" : ""}`}>
              <User className="size-5" />
              Conta
            </button>
          </li>
        </ul>
      </nav>
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
  plusActive,
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
  plusActive: boolean;
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
            <button type="button" onClick={() => onRename(batch)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
              <Pencil className="size-3.5" /> Dar um nome a este grupo
            </button>
          )}
          {pagePlates.map((p) => (
            <PlateCard key={p.id} plate={p} onActivate={onActivate} onDeactivate={onDeactivate} onRelease={onRelease} plusActive={plusActive} onOpenPlus={onOpenPlus} />
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
  onOpenPlus,
}: {
  plate: Plate;
  plusActive: boolean;
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
      {plusActive && active ? (
        <button
          type="button"
          onClick={() => onOpenPlus(plate.id)}
          className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl bg-secondary px-4 text-sm font-bold text-secondary-foreground hover:opacity-90"
        >
          <Crown className="size-4 text-primary" /> Abrir painel Plus deste código
        </button>
      ) : (
        <PlateScanStats plateId={plate.id} />
      )}
      {!toqy && <ToqyStrip href={toqyOnboardingUrl(plate.short_code)} />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-card p-4 card-soft">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl">{value}</p>
    </div>
  );
}
