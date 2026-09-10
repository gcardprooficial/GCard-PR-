import Link from "next/link";

export const metadata = { robots: { index: false } };

// Placeholder. Fluxo real de ativação (cola código -> escolhe/cadastra
// negócio -> confirma link Google) entra na Fase 4.
export default function AtivarPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-5 text-center text-[var(--color-ink)]">
      <div className="max-w-md">
        <h1 className="text-2xl font-black">Ativar placa — em breve</h1>
        <p className="mt-3 text-[var(--color-muted)]">O fluxo de ativação de placas de revenda está sendo montado.</p>
        <Link href="/painel" className="mt-6 inline-flex rounded-full border border-[var(--color-border)] bg-white px-6 py-3 text-sm font-black">Ir pro painel</Link>
      </div>
    </main>
  );
}
