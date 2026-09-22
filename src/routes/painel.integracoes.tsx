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
    </>
  );
}
