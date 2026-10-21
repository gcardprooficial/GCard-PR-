import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Smartphone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { untyped } from "@/lib/db-untyped";
import { createScanSession, pollScanSession } from "@/lib/scan-session.functions";

/** Aceita o que a placa guarda: URL /r/<token>, GCARD-00001 ou o token em hex. Outra coisa (código de barras de rastreio, etc.) é ignorada. */
export function extractPlateCode(raw: string): string | null {
  const m = raw.match(/\/r\/([A-Za-z0-9_-]{4,64})/);
  if (m) return m[1]!.toLowerCase();
  if (/^GCARD-\d{5}$/i.test(raw)) return raw.toUpperCase();
  if (/^[0-9a-f]{32}$/i.test(raw)) return raw.toLowerCase();
  return null;
}

/** PC: mostra um QR; o celular abre o link e vira o bipador (câmera boa, lanterna, foco contínuo). Os códigos chegam aqui. */
export function PhoneScanPanel({ onScan, already, onBack }: { onScan: (code: string) => void; already: Set<string>; onBack: () => void }) {
  const create = useServerFn(createScanSession);
  const poll = useServerFn(pollScanSession);
  const [qr, setQr] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [received, setReceived] = useState<string[]>([]);
  const lastId = useRef(0);
  const seen = useRef(new Set([...already].map((c) => c.toLowerCase())));
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function resolve(raw: string) {
      const code = extractPlateCode(raw.trim());
      if (!code) return void toast.message("Código lido, mas não é de uma placa GCard: ignorei.");
      if (seen.current.has(code.toLowerCase())) return;
      seen.current.add(code.toLowerCase());
      let display = code;
      if (/^[0-9a-f]{32}$/i.test(code)) {
        const { data } = (await untyped(supabase).from("plates").select("short_code").eq("token", code).maybeSingle()) as { data: { short_code?: string } | null };
        if (data?.short_code) {
          display = data.short_code;
          seen.current.add(display.toLowerCase());
        }
      }
      setReceived((r) => [display, ...r]);
      onScan(display);
    }

    void (async () => {
      try {
        const { token } = await create();
        if (stopped) return;
        tokenRef.current = token;
        const url = `${window.location.origin}/bipar/${token}`;
        setLink(url);
        const QRCode = await import("qrcode");
        setQr(await QRCode.toDataURL(url, { margin: 1, width: 260, errorCorrectionLevel: "M" }));
        timer = setInterval(async () => {
          try {
            const r = await poll({ data: { token, afterId: lastId.current } });
            if (!r.ok) return void setError("A sessão expirou. Feche e abra de novo.");
            setConnected(r.connected);
            for (const c of r.codes) {
              lastId.current = Math.max(lastId.current, c.id);
              void resolve(c.code);
            }
          } catch {
            /* falha de rede momentânea: tenta no próximo ciclo */
          }
        }, 1000);
      } catch {
        setError("Não consegui abrir a sessão agora. Tente de novo.");
      }
    })();
    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-zinc-900 p-5 text-white">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-bold"><Smartphone className="size-4" /> Usar o celular como bipador</p>
        <button type="button" onClick={onBack} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs">Voltar</button>
      </div>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs text-white/70">
        <li>Abra a câmera do celular e aponte para o QR abaixo.</li>
        <li>Toque no link. Permita a câmera quando o celular pedir.</li>
        <li>Aponte para a placa. A leitura aparece aqui na hora.</li>
      </ol>
      <div className="mt-4 flex justify-center rounded-xl bg-white p-3">
        {qr ? <img src={qr} alt="QR para conectar o celular" className="size-52" /> : <p className="p-10 text-xs text-black/60">{error ?? "Gerando…"}</p>}
      </div>
      <p className={`mt-3 text-center text-xs font-semibold ${connected ? "text-green-300" : "text-amber-300"}`}>
        {connected ? "✓ Celular conectado" : "Aguardando o celular…"}
      </p>
      {error && qr && <p className="mt-2 text-center text-xs text-amber-300">{error}</p>}
      {link && <p className="mt-2 break-all text-center text-[10px] text-white/30">{link}</p>}
      {received.length > 0 && (
        <ul className="mt-3 max-h-28 space-y-1 overflow-auto font-mono text-xs text-green-300">
          {received.map((c) => <li key={c}>✓ {c}</li>)}
        </ul>
      )}
    </div>
  );
}
