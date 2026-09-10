"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { breakEvenUnits, marginFromPrice, splitProfit, summarize, targetPrice, type FinanceEntry } from "@/lib/finance/calc";

type Entry = FinanceEntry & { id: string; description: string; is_recurring: boolean };
type Partner = { id: string; name: string; share_percent: number };

const CATEGORIES = [
  "venda", "materia_prima", "embalagem", "impressao", "nfc_chip", "frete",
  "taxa_pagamento", "api_google", "api_claude", "api_outro", "anuncio",
  "ferramenta_software", "pro_labore", "imposto", "outro",
];
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${data.session?.access_token ?? ""}`, "Content-Type": "application/json" };
}

export function FinancePanel() {
  const [tab, setTab] = useState<"overview" | "entries" | "calc">("overview");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/finance", { headers: await authHeader() });
    const body = await res.json();
    if (!res.ok) { setErr(body.error ?? "erro"); setLoading(false); return; }
    setEntries(body.entries);
    setPartners(body.partners);
    setLoading(false);
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch de montagem, setState só após await
  useEffect(() => { load(); }, []);

  const sum = useMemo(() => summarize(entries), [entries]);
  const shares = partners.length
    ? partners.map((p) => ({ name: p.name, sharePercent: p.share_percent }))
    : [{ name: "Sócio A", sharePercent: 50 }, { name: "Sócio B", sharePercent: 50 }];

  if (loading) return <p className="text-[var(--color-muted)]">Carregando…</p>;
  if (err) return <p className="text-red-600">Erro: {err}</p>;

  return (
    <div>
      <div className="flex gap-2 border-b border-[var(--color-border)]">
        {([["overview", "Visão geral"], ["entries", "Lançamentos"], ["calc", "Calculadoras"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-black ${tab === k ? "border-[var(--color-accent)] text-[var(--color-ink)]" : "border-transparent text-[var(--color-muted)]"}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "overview" && <Overview sum={sum} shares={shares} />}
        {tab === "entries" && <Entries entries={entries} onChange={load} />}
        {tab === "calc" && <Calc />}
      </div>
    </div>
  );
}

function Card({ label, value, tone }: { label: string; value: string; tone?: "in" | "out" | "profit" }) {
  const color = tone === "in" ? "text-emerald-600" : tone === "out" ? "text-red-600" : "text-[var(--color-ink)]";
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-white p-5">
      <p className="text-xs font-black uppercase tracking-wider text-[var(--color-muted)]">{label}</p>
      <p className={`mt-1 text-2xl font-black ${color}`}>{value}</p>
    </div>
  );
}

function Overview({ sum, shares }: { sum: ReturnType<typeof summarize>; shares: { name: string; sharePercent: number }[] }) {
  const split = splitProfit(sum.profit, shares);
  const cats = Object.entries(sum.byCategory).sort((a, b) => a[1] - b[1]);
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card label="Entrou" value={brl(sum.totalIn)} tone="in" />
        <Card label="Saiu" value={brl(sum.totalOut)} tone="out" />
        <Card label="Lucro" value={brl(sum.profit)} tone="profit" />
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-white p-5">
        <p className="text-sm font-black">Divisão do lucro</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {split.map((s) => (
            <div key={s.name} className="flex justify-between rounded-xl bg-[var(--color-surface)] px-4 py-2 text-sm">
              <span className="font-bold">{s.name}</span><span className="font-black">{brl(s.amount)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-white p-5">
        <p className="text-sm font-black">Por categoria</p>
        <div className="mt-3 space-y-1">
          {cats.length === 0 && <p className="text-sm text-[var(--color-muted)]">Sem lançamentos ainda.</p>}
          {cats.map(([cat, val]) => (
            <div key={cat} className="flex justify-between border-b border-[var(--color-border)] py-1.5 text-sm last:border-0">
              <span>{cat}</span>
              <span className={`font-black ${val < 0 ? "text-red-600" : "text-emerald-600"}`}>{brl(val)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Entries({ entries, onChange }: { entries: Entry[]; onChange: () => void }) {
  const [form, setForm] = useState({ kind: "out", category: "materia_prima", amount: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");
    const res = await fetch("/api/finance", {
      method: "POST",
      headers: await authHeader(),
      body: JSON.stringify({ ...form, amount: Number(form.amount) }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) { setError(body.error ?? "erro"); return; }
    setForm({ ...form, amount: "", description: "" });
    onChange();
  }

  async function del(id: string) {
    if (!confirm("Apagar este lançamento?")) return;
    await fetch(`/api/finance?id=${id}`, { method: "DELETE", headers: await authHeader() });
    onChange();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={add} className="grid gap-3 rounded-2xl border border-[var(--color-border)] bg-white p-5 sm:grid-cols-2">
        <label className="text-sm font-bold">Tipo
          <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2">
            <option value="in">Entrada</option><option value="out">Saída</option>
          </select>
        </label>
        <label className="text-sm font-bold">Categoria
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2">
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="text-sm font-bold">Valor (R$)
          <input required type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2" />
        </label>
        <label className="text-sm font-bold">Descrição
          <input required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2" />
        </label>
        {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
        <button disabled={saving} className="rounded-full bg-[var(--color-accent)] px-6 py-2.5 text-sm font-black text-white sm:col-span-2">
          {saving ? "Salvando…" : "Adicionar lançamento"}
        </button>
      </form>

      <div className="rounded-2xl border border-[var(--color-border)] bg-white p-5">
        {entries.length === 0 && <p className="text-sm text-[var(--color-muted)]">Nenhum lançamento.</p>}
        {entries.map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] py-2 text-sm last:border-0">
            <div>
              <span className="font-bold">{e.description}</span>
              <span className="ml-2 text-xs text-[var(--color-muted)]">{e.category} · {e.entryDate}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className={`font-black ${e.kind === "in" ? "text-emerald-600" : "text-red-600"}`}>
                {e.kind === "in" ? "+" : "−"}{brl(e.amount)}
              </span>
              <button onClick={() => del(e.id)} className="text-xs text-[var(--color-muted)] hover:text-red-600">apagar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Calc() {
  const [cost, setCost] = useState("20");
  const [margin, setMargin] = useState("60");
  const [price, setPrice] = useState("50");
  const [fixed, setFixed] = useState("900");

  const tp = targetPrice(Number(cost) || 0, Number(margin) || 0);
  const mf = marginFromPrice(Number(price) || 0, Number(cost) || 0);
  const be = breakEvenUnits(Number(fixed) || 0, Number(price) || 0, Number(cost) || 0);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="rounded-2xl border border-[var(--color-border)] bg-white p-5">
        <p className="text-sm font-black">Por quanto vender?</p>
        <p className="mt-1 text-xs text-[var(--color-muted)]">Custo unitário + margem desejada (sobre o preço).</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Custo unitário (R$)" value={cost} onChange={setCost} />
          <Field label="Margem (%)" value={margin} onChange={setMargin} />
        </div>
        <p className="mt-4 text-2xl font-black text-[var(--color-accent-dim)]">{brl(tp)}</p>
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-white p-5">
        <p className="text-sm font-black">Qual a margem deste preço?</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Preço de venda (R$)" value={price} onChange={setPrice} />
          <Field label="Custo unitário (R$)" value={cost} onChange={setCost} />
        </div>
        <p className="mt-4 text-sm">Margem <b>{mf.marginPercent}%</b> · markup <b>{mf.markupPercent}%</b> · lucro/un <b>{brl(mf.profitPerUnit)}</b></p>
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-white p-5 md:col-span-2">
        <p className="text-sm font-black">Ponto de equilíbrio</p>
        <p className="mt-1 text-xs text-[var(--color-muted)]">Quantas unidades vender pra cobrir o custo fixo do mês.</p>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <Field label="Custo fixo (R$)" value={fixed} onChange={setFixed} />
          <Field label="Preço (R$)" value={price} onChange={setPrice} />
          <Field label="Custo unitário (R$)" value={cost} onChange={setCost} />
        </div>
        <p className="mt-4 text-2xl font-black">{be === Infinity ? "—" : `${be} unidades`}</p>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="text-xs font-bold text-[var(--color-muted)]">{label}
      <input type="number" step="0.01" value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-base text-[var(--color-ink)]" />
    </label>
  );
}
