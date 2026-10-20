import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AvisosPorEmail } from "@/components/AvisosPorEmail";
import { TUTORIAL_VIDEOS } from "@/lib/tutorial-videos";

function Video({ id, title }: { id: string; title: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 card-soft">
      <p className="flex items-center gap-2 text-sm font-bold">
        <Play className="size-4" /> {title}
      </p>
      <div className="mx-auto mt-3 aspect-[9/16] max-w-[200px] overflow-hidden rounded-xl bg-black">
        <iframe
          className="size-full"
          src={`https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`}
          title={title}
          loading="lazy"
          allow="encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </div>
    </div>
  );
}

/** Aba "Como usar": só tutorial. Nada de painel ou compra aqui. */
export function AjudaTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold">Como usar seus cartões</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Todos os seus cartões funcionam com <strong>QR Code e chip dinâmico</strong>. Você pode trocar o link a qualquer momento.
        </p>
      </div>
      <ol className="grid gap-3 sm:grid-cols-2">
        <li className="rounded-2xl border border-border bg-card p-5 card-soft">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary font-black text-primary-foreground">1</span>
          <p className="mt-3 font-bold">Ativar o link da loja</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Em <em>Meus códigos</em>, abra o lote, informe o <strong>nome do negócio</strong> e cole o <strong>link de avaliação do Google</strong> da loja. Clique em <em>Ativar</em>.
          </p>
        </li>
        <li className="rounded-2xl border border-border bg-card p-5 card-soft">
          <span className="flex size-8 items-center justify-center rounded-full bg-secondary font-black text-secondary-foreground">2</span>
          <p className="mt-3 font-bold">Gravar a aproximação (NFC)</p>
          <p className="mt-1 text-sm text-muted-foreground">
            No app <strong>NFC Tools</strong> (grátis): <em>Escrever</em> &gt; <em>Adicionar registro</em> &gt; <em>URL</em>. Cole o link do botão <strong>Copiar URL NFC</strong> do seu código e encoste no chip.
          </p>
        </li>
      </ol>
      <div className="grid gap-3 sm:grid-cols-2">
        <Video id={TUTORIAL_VIDEOS.qr} title="Configurar o QR Code" />
        <Video id={TUTORIAL_VIDEOS.nfc} title="Configurar o NFC" />
      </div>
      <div className="rounded-2xl border border-border bg-card p-5 card-soft">
        <p className="font-bold">Precisa de ajuda?</p>
        <p className="mt-1 text-sm text-muted-foreground">Fale com a gente pelo Instagram e respondemos o quanto antes.</p>
        <Button asChild className="mt-3 rounded-xl">
          <a href="https://instagram.com/gcardpro.oficial" target="_blank" rel="noopener noreferrer">@gcardpro.oficial</a>
        </Button>
      </div>
    </div>
  );
}

/** Aba "Minha conta": e-mail, avisos e sair. */
export function ContaTab({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl font-bold">Minha conta</h2>
      <div className="rounded-2xl border border-border bg-card p-5 card-soft">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">E-mail de acesso</p>
        <p className="mt-1 font-semibold">{email}</p>
        <Button variant="outline" className="mt-4 rounded-xl" onClick={onSignOut}>
          Sair da conta
        </Button>
      </div>
      <AvisosPorEmail />
    </div>
  );
}
