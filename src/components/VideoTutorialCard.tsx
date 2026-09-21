import { useState } from "react";
import { Play } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

const VIDEO_ID = "6nDW3OCKcAA";
const TITLE = "Aprenda a Configurar o QRCODE";

/**
 * Vídeo tutorial no hero. Só mostra a miniatura e carrega o player do YouTube
 * quando a pessoa clica -- não pesa a página nem começa a tocar sozinho.
 */
export function VideoTutorialCard() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-analytics-event="video_tutorial_abrir"
        aria-label={`Assistir vídeo: ${TITLE}`}
        className="group flex w-full items-center gap-3.5 rounded-3xl border border-border bg-card p-3 pr-4 text-left card-soft card-soft-hover transition-transform duration-300 hover:-translate-y-0.5 sm:p-3.5 lg:gap-5 lg:p-4"
      >
        <span className="relative block aspect-video w-28 shrink-0 overflow-hidden rounded-2xl bg-foreground sm:w-36 md:w-28 lg:w-44">
          <img
            src={`https://i.ytimg.com/vi/${VIDEO_ID}/hqdefault.jpg`}
            alt=""
            loading="lazy"
            draggable={false}
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <span className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-9 items-center justify-center rounded-full bg-primary lg:size-11 text-primary-foreground shadow-lg shadow-black/30 transition-transform duration-300 group-hover:scale-110">
              <Play className="ml-0.5 size-4 fill-current lg:size-5" />
            </span>
          </span>
        </span>

        <span className="min-w-0">
          <span className="text-[11px] font-black uppercase tracking-[0.18em] text-primary">
            Vídeo
          </span>
          <span className="mt-1 block font-display text-base leading-snug lg:text-xl">{TITLE}</span>
          <span className="mt-1 block text-xs font-semibold text-muted-foreground sm:text-sm">
            Assistir agora →
          </span>
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-3xl gap-0 overflow-hidden rounded-3xl border-0 bg-black p-0 sm:w-full">
          <DialogTitle className="sr-only">{TITLE}</DialogTitle>
          <DialogDescription className="sr-only">Vídeo do YouTube com o tutorial.</DialogDescription>
          <div className="aspect-video w-full">
            <iframe
              className="size-full"
              src={`https://www.youtube-nocookie.com/embed/${VIDEO_ID}?autoplay=1&rel=0&modestbranding=1`}
              title={TITLE}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
