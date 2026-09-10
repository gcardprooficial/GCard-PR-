import Link from "next/link";

export const metadata = { robots: { index: false } };

export default function Page() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-5 text-center text-[var(--color-ink)]">
      <div className="max-w-md">
        <p className="text-xs font-black uppercase tracking-wider text-[var(--color-accent-dim)]">Pré-venda de lançamento</p>
        <h1 className="mt-2 text-2xl font-black md:text-3xl">Abrindo em breve</h1>
        <p className="mt-3 text-[var(--color-muted)]">O fluxo de compra está sendo finalizado. Entre no grupo de lançamento no WhatsApp pra garantir sua placa com preço de lançamento.</p>
        <Link href="/" className="mt-6 inline-flex rounded-full border border-[var(--color-border)] bg-white px-6 py-3 text-sm font-black">Voltar</Link>
      </div>
    </main>
  );
}
