import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ScanLine, Zap, ZapOff } from "lucide-react";
import { pingScanSession, sendScanCode } from "@/lib/scan-session.functions";

export const Route = createFileRoute("/bipar/$token")({
  head: () => ({ meta: [{ title: "Bipador | GCard-PRÓ" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: Bipar,
});

// Formatos de código de barras que o leitor nativo do celular entende, além do QR.
const FORMATS = ["qr_code", "code_128", "code_39", "code_93", "ean_13", "ean_8", "upc_a", "upc_e", "itf", "codabar", "data_matrix"];
type Detector = { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> };

function Bipar() {
  const { token } = Route.useParams();
  const ping = useServerFn(pingScanSession);
  const send = useServerFn(sendScanCode);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [state, setState] = useState<"abrindo" | "pronto" | "erro" | "expirou">("abrindo");
  const [msg, setMsg] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [torch, setTorch] = useState(false);
  const [canTorch, setCanTorch] = useState(false);
  const [zoom, setZoom] = useState<{ min: number; max: number; step: number; value: number } | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);

  useEffect(() => {
    let stopped = false;
    let scanner: import("qr-scanner").default | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;
    let wake: { release: () => Promise<void> } | null = null;
    const seen = new Map<string, number>();

    async function handle(raw: string) {
      const code = raw.trim();
      if (code.length < 2) return;
      const now = Date.now();
      if (now - (seen.get(code) ?? 0) < 2500) return; // câmera parada no mesmo código
      seen.set(code, now);
      try {
        navigator.vibrate?.(60);
      } catch {
        /* sem vibração */
      }
      try {
        const r = await send({ data: { token, code } });
        if (!r.ok) {
          if (r.reason === "expired") return void setState("expirou");
          return void setMsg("Não consegui enviar agora. Tente de novo.");
        }
        setMsg("");
        setCodes((c) => [code, ...c.filter((x) => x !== code)].slice(0, 30));
      } catch {
        setMsg("Sem conexão com o servidor. Confira a internet do celular.");
      }
    }

    async function start() {
      const first = await ping({ data: { token } }).catch(() => null);
      if (!first || !first.ok) return void setState("expirou");
      pingTimer = setInterval(() => void ping({ data: { token } }).then((r) => !r.ok && setState("expirou")).catch(() => {}), 10_000);
      try {
        const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
        wake = (await nav.wakeLock?.request("screen")) ?? null; // tela não apaga
      } catch {
        wake = null;
      }

      let stream: MediaStream;
      try {
        // Câmera traseira em alta resolução, com foco contínuo (o que faz a imagem ficar nítida de perto).
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
          audio: false,
        });
      } catch {
        setMsg("Não consegui abrir a câmera. Permita o acesso à câmera nas configurações do navegador e recarregue.");
        return void setState("erro");
      }
      if (stopped || !videoRef.current) return stream.getTracks().forEach((t) => t.stop());
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play().catch(() => {});
      const track = stream.getVideoTracks()[0]!;
      trackRef.current = track;
      const caps = (track.getCapabilities?.() ?? {}) as Record<string, unknown> & { torch?: boolean; zoom?: { min: number; max: number; step: number } };
      try {
        await track.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] });
      } catch {
        /* aparelho sem controle de foco: segue com o automático */
      }
      setCanTorch(!!caps.torch);
      if (caps.zoom) setZoom({ min: caps.zoom.min, max: caps.zoom.max, step: caps.zoom.step || 0.1, value: caps.zoom.min });
      setState("pronto");

      // 1) Leitor nativo (rápido, trata códigos de barras 1D e QR) quando o aparelho tem.
      const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector & { constructor: { getSupportedFormats?: () => Promise<string[]> } } }).BarcodeDetector;
      if (BD) {
        try {
          const supported = (await (BD as unknown as { getSupportedFormats?: () => Promise<string[]> }).getSupportedFormats?.()) ?? FORMATS;
          const detector = new BD({ formats: FORMATS.filter((f) => supported.includes(f)) });
          let busy = false;
          timer = setInterval(async () => {
            if (busy || video.readyState < 2) return;
            busy = true;
            try {
              for (const r of await detector.detect(video)) void handle(r.rawValue);
            } catch {
              /* quadro sem código */
            } finally {
              busy = false;
            }
          }, 120);
        } catch {
          /* cai no leitor de QR abaixo */
        }
      }
      // 2) Leitor de QR por software (funciona em todos os celulares, inclusive iPhone).
      const [{ default: QrScanner }, workerUrl] = await Promise.all([
        import("qr-scanner"),
        import("qr-scanner/qr-scanner-worker.min.js?url").then((m) => m.default),
      ]);
      QrScanner.WORKER_PATH = workerUrl;
      if (stopped) return;
      scanner = new QrScanner(video, (r) => void handle(r.data), { returnDetailedScanResult: true, maxScansPerSecond: 12, highlightScanRegion: false, highlightCodeOutline: false });
      await scanner.start().catch(() => {});
    }
    void start();

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      if (pingTimer) clearInterval(pingTimer);
      scanner?.destroy();
      void wake?.release().catch(() => {});
      (videoRef.current?.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function toggleTorch() {
    const track = trackRef.current;
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] });
      setTorch(!torch);
    } catch {
      setMsg("Esse aparelho não deixou ligar a lanterna.");
    }
  }
  async function changeZoom(v: number) {
    setZoom((z) => (z ? { ...z, value: v } : z));
    try {
      await trackRef.current?.applyConstraints({ advanced: [{ zoom: v } as MediaTrackConstraintSet] });
    } catch {
      /* zoom não suportado */
    }
  }

  if (state === "expirou") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black p-6 text-center text-white">
        <div>
          <p className="text-xl font-bold">Sessão encerrada</p>
          <p className="mt-2 text-sm text-white/70">Volte ao computador, toque em "Usar o celular" e leia o QR de novo.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-black text-white">
      <header className="flex items-center justify-between px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-bold"><ScanLine className="size-4 text-amber-400" /> Bipador GCard-PRÓ</p>
        <span className="rounded-full bg-green-500/20 px-3 py-1 text-xs font-semibold text-green-300">{state === "pronto" ? "Conectado ao PC" : "Abrindo…"}</span>
      </header>

      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} muted playsInline className="absolute inset-0 size-full object-cover" />
        {/* moldura e linha de laser */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative aspect-square w-[72%] max-w-sm">
            {["left-0 top-0 border-l-4 border-t-4 rounded-tl-2xl", "right-0 top-0 border-r-4 border-t-4 rounded-tr-2xl", "left-0 bottom-0 border-l-4 border-b-4 rounded-bl-2xl", "right-0 bottom-0 border-r-4 border-b-4 rounded-br-2xl"].map((c) => (
              <span key={c} className={`absolute size-10 border-amber-400 ${c}`} />
            ))}
            <span className="absolute inset-x-2 h-0.5 animate-[laser_1.6s_ease-in-out_infinite] bg-red-500 shadow-[0_0_12px_2px_rgba(239,68,68,0.9)]" />
          </div>
        </div>
        <style>{`@keyframes laser { 0%,100% { top: 6%; } 50% { top: 92%; } }`}</style>
        {state === "erro" && <p className="absolute inset-x-6 top-1/3 text-center text-sm text-amber-300">{msg}</p>}
      </div>

      <div className="space-y-3 bg-zinc-950 px-4 pb-6 pt-3">
        <div className="flex items-center gap-3">
          {canTorch && (
            <button type="button" onClick={() => void toggleTorch()} className={`inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold ${torch ? "bg-amber-400 text-black" : "bg-white/10"}`}>
              {torch ? <Zap className="size-4" /> : <ZapOff className="size-4" />} Lanterna
            </button>
          )}
          {zoom && (
            <label className="flex flex-1 items-center gap-2 text-xs text-white/70">
              Zoom
              <input type="range" min={zoom.min} max={zoom.max} step={zoom.step} value={zoom.value} onChange={(e) => void changeZoom(Number(e.target.value))} className="flex-1" />
            </label>
          )}
        </div>
        {msg && state !== "erro" && <p className="text-xs text-amber-300">{msg}</p>}
        <p className="text-xs text-white/50">Aponte para o QR ou código de barras da placa. Cada leitura aparece no computador na hora.</p>
        {codes.length > 0 && (
          <ul className="max-h-28 space-y-1 overflow-auto text-sm">
            {codes.map((c) => (
              <li key={c} className="flex items-center gap-2 font-mono text-green-300"><CheckCircle2 className="size-4 shrink-0" /><span className="truncate">{c.replace(/^https?:\/\/[^/]+\/r\//, "…/r/")}</span></li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
