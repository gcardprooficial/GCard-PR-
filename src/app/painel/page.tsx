"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { FinancePanel } from "./FinancePanel";

type State =
  | { step: "loading" }
  | { step: "login" }
  | { step: "denied"; email: string }
  | { step: "ok"; email: string };

export default function PainelPage() {
  const [state, setState] = useState<State>({ step: "loading" });

  async function check() {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) return setState({ step: "login" });
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    setState(profile?.role === "admin" || profile?.role === "staff"
      ? { step: "ok", email: user.email ?? "" }
      : { step: "denied", email: user.email ?? "" });
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect -- checagem de sessão na montagem, setState só após await
  useEffect(() => { check(); }, []);

  if (state.step === "loading") return <Shell><p className="text-[var(--color-muted)]">Carregando…</p></Shell>;
  if (state.step === "login") return <Shell><Login onDone={check} /></Shell>;
  if (state.step === "denied") return (
    <Shell>
      <p className="font-black">Sem acesso</p>
      <p className="mt-1 text-sm text-[var(--color-muted)]">{state.email} não é admin/staff. Peça pra liberar seu acesso.</p>
      <button onClick={() => supabase.auth.signOut().then(check)} className="mt-4 text-sm font-bold underline">Sair</button>
    </Shell>
  );

  return (
    <Shell wide>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">Painel</h1>
        <button onClick={() => supabase.auth.signOut().then(check)} className="text-sm font-bold text-[var(--color-muted)] hover:underline">Sair</button>
      </div>
      <p className="mt-1 text-sm text-[var(--color-muted)]">{state.email}</p>
      <div className="mt-8"><FinancePanel /></div>
    </Shell>
  );
}

function Shell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <main className="min-h-screen bg-[var(--color-bg)] px-5 py-12 text-[var(--color-ink)]">
      <div className={`mx-auto ${wide ? "max-w-4xl" : "max-w-sm rounded-3xl border border-[var(--color-border)] bg-white p-8 shadow-lg"}`}>{children}</div>
    </main>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setErr(error.message);
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-lg font-black">Entrar no painel</p>
      <input required type="email" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2" />
      <input required type="password" placeholder="senha" value={password} onChange={(e) => setPassword(e.target.value)}
        className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2" />
      {err && <p className="text-sm text-red-600">{err}</p>}
      <button disabled={busy} className="w-full rounded-full bg-[var(--color-accent)] px-6 py-2.5 text-sm font-black text-white">
        {busy ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
