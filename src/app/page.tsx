import Link from "next/link";
import { ArrowRight, Clock, MapPin, Nfc, QrCode, Star } from "lucide-react";
import { getPlateProductsServer } from "@/lib/plate/catalogServer";
import { PLATE_PREORDER, launchWhatsappGroup } from "@/lib/plate/config";

export const revalidate = 300;

export default async function LandingPage() {
  const products = await getPlateProductsServer();
  const group = launchWhatsappGroup();

  return (
    <main className="min-h-screen bg-[var(--color-bg)] text-[var(--color-ink)]">
      <header className="border-b border-[var(--color-border)] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <span className="text-lg font-black">Placas de avaliação</span>
          <Link href="/painel" className="text-sm font-bold text-[var(--color-muted)] hover:text-[var(--color-ink)]">Área do revendedor</Link>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-5 py-20 text-center">
        <p className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-white px-4 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-[var(--color-accent-dim)]">
          <Nfc className="h-3.5 w-3.5" /> QR Code + NFC
        </p>
        <h1 className="mx-auto mt-6 max-w-2xl text-4xl font-black leading-tight md:text-6xl">Aproximou. Clicou. Avaliou.</h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-[var(--color-muted)]">
          A placa que fica no balcão e leva o cliente direto pra avaliar seu negócio no Google. Troca o link quando quiser, sem reimprimir.
        </p>

        {PLATE_PREORDER.enabled ? (
          <div className="mx-auto mt-8 max-w-lg rounded-2xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 p-4 text-left">
            <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[var(--color-accent-dim)]"><Clock className="h-3.5 w-3.5" /> {PLATE_PREORDER.badge}</p>
            <p className="mt-1.5 text-base font-black">{PLATE_PREORDER.headline}</p>
            <p className="mt-1 text-sm text-[var(--color-muted)]">{PLATE_PREORDER.detail}</p>
          </div>
        ) : null}

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/comprar" className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] px-7 py-4 font-black text-white sm:w-auto">Quero uma placa pro meu negócio <ArrowRight className="h-4 w-4" /></Link>
          <Link href="/revenda" className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[var(--color-border)] bg-white px-7 py-4 font-black sm:w-auto">Comprar em lote e revender</Link>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-12">
        <div className="grid gap-6 md:grid-cols-3">
          <Feature icon={<QrCode className="h-5 w-5" />} title="QR + NFC" desc="O cliente aproxima o celular ou escaneia. Cai direto na avaliação do Google." />
          <Feature icon={<MapPin className="h-5 w-5" />} title="Link dinâmico" desc="O QR aponta pra um link nosso. Mudou o Google? Troca aqui, a placa continua a mesma." />
          <Feature icon={<Star className="h-5 w-5" />} title="Pagamento único" desc="Sem mensalidade. Chega pronta pra ficar no balcão." />
        </div>
      </section>

      {products.length ? (
        <section className="mx-auto max-w-5xl px-5 pb-12">
          <h2 className="text-2xl font-black md:text-3xl">Os formatos</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <div key={p.id} className={`rounded-3xl border p-6 shadow-sm ${p.comingSoon ? "border-[var(--color-border)] bg-[var(--color-surface)] opacity-70" : "border-[var(--color-border)] bg-white"}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-lg font-black">{p.name}</p>
                  {p.comingSoon ? <span className="shrink-0 rounded-full bg-black/10 px-2.5 py-0.5 text-[11px] font-black">Em breve</span> : null}
                </div>
                {p.description ? <p className="mt-1 text-sm text-[var(--color-muted)]">{p.description}</p> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {group ? (
        <section className="mx-auto max-w-3xl px-5 py-10">
          <a href={group} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4">
            <span>
              <span className="block text-sm font-black">Entre no grupo de lançamento no WhatsApp</span>
              <span className="block text-xs text-[var(--color-muted)]">Preço de lançamento e prazo em primeira mão.</span>
            </span>
            <span className="shrink-0 rounded-full bg-emerald-600 px-4 py-2 text-sm font-black text-white">Entrar</span>
          </a>
        </section>
      ) : null}

      <footer className="border-t border-[var(--color-border)] bg-white py-10 text-center text-sm text-[var(--color-muted)]">
        <p>© {new Date().getFullYear()} — Placas de avaliação.</p>
      </footer>
    </main>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-3xl border border-[var(--color-border)] bg-white p-6 shadow-sm">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-accent)]/10 text-[var(--color-accent)]">{icon}</span>
      <p className="mt-3 text-lg font-black">{title}</p>
      <p className="mt-1 text-sm text-[var(--color-muted)]">{desc}</p>
    </div>
  );
}
