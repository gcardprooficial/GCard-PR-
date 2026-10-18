import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getMelhorEnvioConnectUrl,
  getMelhorEnvioStatus,
  testMelhorEnvioConnection,
} from "@/lib/shipping/melhorenvio.functions";
import { Button } from "@/components/ui/button";
import { getHubStatus, runHubSyncNow, testHubSync } from "@/lib/hub-sync.functions";

const searchSchema = (search: Record<string, unknown>) => ({
  melhorenvio: typeof search["melhorenvio"] === "string" ? search["melhorenvio"] : undefined,
  msg: typeof search["msg"] === "string" ? search["msg"] : undefined,
});

export const Route = createFileRoute("/painel/integracoes")({
  validateSearch: searchSchema,
  component: Integracoes,
});

function Integracoes() {
  const search = Route.useSearch();
  const runGetUrl = useServerFn(getMelhorEnvioConnectUrl);
  const runStatus = useServerFn(getMelhorEnvioStatus);
  const runTest = useServerFn(testMelhorEnvioConnection);

  const [status, setStatus] = useState<{ connected: boolean; expiresAt: number | null } | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const runHubStatus = useServerFn(getHubStatus);
  const runHubTest = useServerFn(testHubSync);
  const [hub, setHub] = useState<{ configured: boolean; outbox: boolean; sync: boolean } | null>(null);
  const [hubTesting, setHubTesting] = useState(false);
  const [hubResult, setHubResult] = useState<string | null>(null);
  const runHubFull = useServerFn(runHubSyncNow);
  const [hubRunning, setHubRunning] = useState(false);
  const [hubFullResult, setHubFullResult] = useState<string | null>(null);

  async function runFull() {
    if (hubRunning) return; // duplo clique
    if (!confirm("Enviar TODAS as contas ao hub agora?")) return;
    setHubRunning(true);
    setHubFullResult(null);
    try {
      const r = await runHubFull();
      if (!r.ok) {
        setHubFullResult(
          r.motivo === "carga_desligada"
            ? "A carga diária está DESLIGADA (HUB_SYNC_ENABLED). Nada foi enviado."
            : r.motivo === "ja_em_execucao"
              ? "Já existe uma carga em andamento. Aguarde terminar."
              : r.motivo === "hub_nao_configurado"
                ? "Hub não configurado (faltam HUB_INGEST_URL e HUB_INGEST_SECRET)."
                : `Não rodou: ${r.motivo}.`,
        );
      } else {
        setHubFullResult(
          `Lidos: ${r.lidos} · enviados: ${r.enviados} · lotes aplicados: ${r.aplicados}/${r.lotes} · linhas aplicadas pelo hub: ${r.linhas}` +
            (r.parou ? ` · PAROU por erro: ${r.parou}` : " · sem erro."),
        );
      }
    } catch {
      setHubFullResult("Não consegui rodar agora.");
    } finally {
      setHubRunning(false);
    }
  }

  useEffect(() => {
    runHubStatus().then(setHub).catch(() => setHub(null));
  }, [runHubStatus]);

  async function testHub() {
    setHubTesting(true);
    setHubResult(null);
    try {
      const r = await runHubTest();
      setHubResult(
        r.motivo === "hub_nao_configurado"
          ? "Hub não configurado (faltam HUB_INGEST_URL e HUB_INGEST_SECRET na Vercel)."
          : r.ok
            ? `Hub respondeu ok: ${r.linhas ?? "?"} linha(s) aplicada(s).`
            : `Hub respondeu ${r.status === null ? "sem conexão" : `HTTP ${r.status}`}. Conferir segredo, endereço e relógio.`,
      );
    } catch {
      setHubResult("Não consegui testar agora.");
    } finally {
      setHubTesting(false);
    }
  }

  async function load() {
    try {
      setStatus(await runStatus());
    } catch {
      toast.error("Não consegui conferir o status da integração.");
    }
  }

  useEffect(() => {
    void load();
    if (search.melhorenvio === "ok") toast.success("Melhor Envio conectado!");
    if (search.melhorenvio === "erro") toast.error(search.msg ?? "Falha ao conectar o Melhor Envio.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function connect() {
    setConnecting(true);
    try {
      const { url } = await runGetUrl();
      window.location.href = url;
    } catch (error) {
      setConnecting(false);
      toast.error(error instanceof Error ? error.message : "Não consegui iniciar a conexão.");
    }
  }

  async function test() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await runTest();
      if (res.ok) {
        setTestResult(`Conectado como: ${res.name}`);
        toast.success("Conexão funcionando!");
      } else {
        setTestResult(`Falhou: ${res.error}`);
        toast.error("Não consegui confirmar a conexão.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao testar.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <>
      <h1 className="text-2xl">Integrações</h1>

      <div className="mt-6 max-w-xl rounded-2xl bg-card p-5 card-soft">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-bold">Melhor Envio</p>
            <p className="text-sm text-muted-foreground">Cotação, etiqueta e rastreio (fase 1: conexão).</p>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              status?.connected ? "bg-green-100 text-green-800" : "bg-secondary text-white"
            }`}
          >
            {status === null ? "Verificando…" : status.connected ? "Conectado" : "Não conectado"}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void connect()} disabled={connecting}>
            {connecting ? "Abrindo…" : status?.connected ? "Reconectar" : "Conectar"}
          </Button>
          {status?.connected && (
            <Button size="sm" variant="outline" onClick={() => void test()} disabled={testing}>
              {testing ? "Testando…" : "Testar conexão"}
            </Button>
          )}
        </div>

        {testResult && <p className="mt-3 text-sm text-muted-foreground">{testResult}</p>}
      </div>

      <div className="mt-4 rounded-2xl bg-card p-5 card-soft">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-bold">Hub</p>
            <p className="text-sm text-muted-foreground">Eventos assinados e carga diária de contas.</p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${hub?.configured ? "bg-green-100 text-green-800" : "bg-secondary text-white"}`}>
            {hub === null ? "Verificando…" : hub.configured ? "Configurado" : "Não configurado"}
          </span>
        </div>
        {hub && (
          <p className="mt-2 text-sm text-muted-foreground">
            Envio de eventos: <strong>{hub.outbox ? "ligado" : "desligado"}</strong> · Carga diária: <strong>{hub.sync ? "ligada" : "desligada"}</strong>
          </p>
        )}
        <div className="mt-4">
          <Button size="sm" variant="outline" onClick={() => void testHub()} disabled={hubTesting || !hub?.configured}>
            {hubTesting ? "Testando…" : "Testar envio (2 contas fictícias)"}
          </Button>
        </div>
        {hubResult && <p className="mt-3 text-sm text-muted-foreground">{hubResult}</p>}
        <div className="mt-4">
          <Button size="sm" onClick={() => void runFull()} disabled={hubRunning || !hub?.configured}>
            {hubRunning ? "Enviando… (não feche a página)" : "Rodar carga completa agora"}
          </Button>
        </div>
        {hubFullResult && <p className="mt-3 text-sm text-muted-foreground">{hubFullResult}</p>}
      </div>
    </>
  );
}
