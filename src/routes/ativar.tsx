import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logoTransparente from "@/assets/logo/gcard-pro-logo-transparente.webp";

export const Route = createFileRoute("/ativar")({
  head: () => ({
    meta: [
      { title: "Ativar meus códigos | GCard-PRÓ" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Ativar,
});

const GOOGLE_HOST_RE =
  /^https:\/\/(search\.google\.com|www\.google\.com|google\.com|maps\.google\.com|g\.page)\//;

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
};

function Ativar() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!ready)
    return <Center>Carregando…</Center>;
  if (!session) return <Login />;
  return <Lote email={session.user.email ?? ""} userId={session.user.id} />;
}

function Center({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-5 text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const fn =
      mode === "login"
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password });
    const { error } = await fn;
    setBusy(false);
    if (error) {
      toast.error(mode === "login" ? "E-mail ou senha inválidos." : error.message);
      return;
    }
    if (mode === "signup") toast.success("Conta criada. Pode entrar.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-5">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl bg-card p-8 card-soft">
        <Link to="/" className="inline-flex items-center">
          <img src={logoTransparente} alt="GCard-PRÓ" className="h-10 w-auto" draggable={false} />
        </Link>
        <h1 className="mt-4 text-xl">Ativar meus códigos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Use o mesmo e-mail que você usou na compra do lote.
        </p>
        <div className="mt-6 space-y-4">
          <div>
            <Label htmlFor="e">E-mail</Label>
            <Input id="e" type="email" value={email} onChange={(ev) => setEmail(ev.target.value)} className="mt-1 h-11" required />
          </div>
          <div>
            <Label htmlFor="p">Senha</Label>
            <Input id="p" type="password" value={password} onChange={(ev) => setPassword(ev.target.value)} className="mt-1 h-11" required minLength={6} />
          </div>
        </div>
        <Button type="submit" className="mt-6 w-full" disabled={busy}>
          {busy ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}
        </Button>
        <button
          type="button"
          onClick={() => setMode((m) => (m === "login" ? "signup" : "login"))}
          className="mt-3 w-full text-center text-sm text-muted-foreground hover:text-foreground"
        >
          {mode === "login" ? "Primeira vez? Criar conta" : "Já tenho conta"}
        </button>
      </form>
    </div>
  );
}

function Lote({ email, userId }: { email: string; userId: string }) {
  const [batches, setBatches] = useState<Batch[] | null>(null);
  const [plates, setPlates] = useState<Plate[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "ativada" | "nao_ativada">("all");
  const [redeemCode, setRedeemCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);

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
          "id, token, short_code, status, destination_url, business_name, sold_to, batch_id, last_scan_at, scan_count",
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
    const url = reviewUrl.trim();
    if (!GOOGLE_HOST_RE.test(url)) {
      toast.error("O link precisa ser da avaliação do Google (search.google.com/...).");
      return;
    }
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

  const filtered = plates.filter((p) => {
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

  if (batches === null) return <Center>Carregando…</Center>;

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <Link to="/" className="inline-flex items-center gap-3">
            <img src={logoTransparente} alt="GCard-PRÓ" className="h-9 w-auto" draggable={false} />
            <span className="text-muted-foreground">/ meus códigos</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-muted-foreground sm:inline">{email}</span>
            <Button size="sm" variant="outline" onClick={() => supabase.auth.signOut()}>
              Sair
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-5 py-8">
        <form onSubmit={redeem} className="rounded-2xl bg-card p-5 card-soft border border-dashed border-primary/40 mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
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
            <div className="rounded-2xl bg-card p-6 card-soft border border-border">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="badge-pill bg-primary/20 text-foreground font-black text-xs">
                    Painel do Revendedor
                  </span>
                  <h2 className="mt-2 font-display text-xl font-bold">Como gerenciar e ativar seus cartões</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Todos os seus cartões funcionam com <strong>QR Code e chip dinâmico</strong>. O link de avaliação do seu cliente pode ser atualizado por você a qualquer momento.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border bg-surface p-4 text-xs leading-relaxed">
                  <p className="font-bold text-foreground text-sm flex items-center gap-2">
                    <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground font-black text-xs">1</span>
                    Ativar o link da loja
                  </p>
                  <p className="mt-2 text-muted-foreground">
                    Localize o código do cartão na lista abaixo, informe o <strong>Nome do Negócio</strong> e cole o <strong>Link de Avaliação do Google</strong> da loja que você atendeu. Clique em <em>Ativar</em>.
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-surface p-4 text-xs leading-relaxed">
                  <p className="font-bold text-foreground text-sm flex items-center gap-2">
                    <span className="flex size-6 items-center justify-center rounded-full bg-secondary text-secondary-foreground font-black text-xs">2</span>
                    Gravar aproximação (NFC Tools)
                  </p>
                  <p className="mt-2 text-muted-foreground">
                    Abra o app <strong>NFC Tools</strong> (grátis para Android/iPhone) &gt; <em>Escrever</em> &gt; <em>Adicionar Registro</em> &gt; <em>URL</em>. Cole o link dinâmico do cartão e encoste no chip!
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Stat label="Total de códigos" value={counts.total} />
              <Stat label="Ativados" value={counts.active} />
              <Stat label="Em branco" value={counts.blank} />
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold">Cartões por lote</h2>
                <p className="text-xs text-muted-foreground">Clique num lote pra abrir e ativar os cartões dele</p>
              </div>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar código / negócio" className="h-10 w-full sm:w-64 input-soft rounded-xl" />
            </div>

            <div className="mt-3 flex gap-1 rounded-full bg-secondary p-1 text-xs font-semibold">
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
                  />
                );
              })}
            </div>
          </>
        )}
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
}: {
  batch: Batch | null;
  number: number;
  plates: Plate[];
  forceOpen: boolean;
  onActivate: (p: Plate, name: string, url: string, soldTo: string) => void;
  onDeactivate: (p: Plate) => void;
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

  const title = batch
    ? `Lote ${String(number).padStart(2, "0")}`
    : "Sem lote";
  const subtitle = batch
    ? `${batch.products?.name ?? "Cartão de bolso"} · ${batch.quantity} un.${batch.label ? ` · ${batch.label}` : ""}`
    : "Cartões avulsos";

  return (
    <div className="rounded-2xl bg-card card-soft border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <div>
          <p className="font-display text-base font-bold">{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-muted-foreground">
            {activeCount}/{plates.length} ativados
          </span>
          <span className={`transition-transform ${isOpen ? "rotate-180" : ""}`}>▾</span>
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-border p-4 pt-3 space-y-3">
          {pagePlates.map((p) => (
            <PlateCard key={p.id} plate={p} onActivate={onActivate} onDeactivate={onDeactivate} />
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
}: {
  plate: Plate;
  onActivate: (p: Plate, name: string, url: string, soldTo: string) => void;
  onDeactivate: (p: Plate) => void;
}) {
  const [name, setName] = useState(plate.business_name ?? "");
  const [url, setUrl] = useState(plate.destination_url ?? "");
  const [soldTo, setSoldTo] = useState(plate.sold_to ?? "");
  const active = plate.status === "ativada";
  const dynamicUrl = `${typeof window !== "undefined" ? window.location.origin : "https://gcardpro.com.br"}/r/${plate.token}`;

  function copyDynamicUrl() {
    navigator.clipboard.writeText(dynamicUrl);
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
          {active ? "✓ Ativado no Google" : "○ Em branco (Sem loja)"}
        </span>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">{plate.scan_count} toque(s) / leitura(s) registradas</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs font-semibold">Nome do negócio / Loja</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Barbearia Silva"
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
          <Label className="text-xs font-semibold">Link de avaliação do Google</Label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://search.google.com/local/writereview?placeid=..."
            className="mt-1 h-10 input-soft rounded-xl"
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
      </div>
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
