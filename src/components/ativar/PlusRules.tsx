import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { untyped } from "@/lib/db-untyped";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { checkDestination, type DestinationRule } from "@/lib/destination";
import { describeRule, ruleMatches, type PlateRule } from "@/lib/plate-rules";

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Plus: destinos por horário, dia e validade de UM código. A primeira regra da lista que casar vence; senão vale o destino normal. */
export function PlusRules({ plateId, defaultUrl, rules, allowedUrls }: { plateId: string; defaultUrl: string | null; rules: DestinationRule[]; allowedUrls: string[] }) {
  const [list, setList] = useState<PlateRule[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ label: "", url: "", days: [] as number[], start: "", end: "", from: "", until: "" });

  const load = useCallback(async () => {
    const { data } = await untyped(supabase)
      .from("plate_rules")
      .select("id, label, destination_url, days, start_time, end_time, valid_from, valid_until, enabled, position")
      .eq("plate_id", plateId)
      .order("position", { ascending: true });
    setList((data ?? []) as PlateRule[]);
  }, [plateId]);
  useEffect(() => {
    void load();
  }, [load]);

  async function add() {
    const c = checkDestination(f.url, rules, allowedUrls);
    if (!c.ok) return void toast.error(c.reason);
    if ((f.start === "") !== (f.end === "")) return void toast.error("Preencha o horário de início e o de fim (ou deixe os dois vazios).");
    if (f.from && f.until && f.until < f.from) return void toast.error("A data final não pode ser antes da inicial.");
    setBusy(true);
    const { error } = await untyped(supabase).from("plate_rules").insert({
      plate_id: plateId,
      label: f.label.trim() || null,
      destination_url: c.url,
      days: f.days.length ? f.days : null,
      start_time: f.start || null,
      end_time: f.end || null,
      valid_from: f.from || null,
      valid_until: f.until || null,
      position: (list?.reduce((m, r) => Math.max(m, r.position), 0) ?? 0) + 1,
    });
    setBusy(false);
    if (error) return void toast.error(error.message);
    toast.success("Regra criada.");
    setF({ label: "", url: "", days: [], start: "", end: "", from: "", until: "" });
    setAdding(false);
    void load();
  }

  async function toggle(r: PlateRule) {
    const { error } = await untyped(supabase).from("plate_rules").update({ enabled: !r.enabled }).eq("id", r.id);
    if (error) return void toast.error(error.message);
    void load();
  }
  async function remove(r: PlateRule) {
    if (!window.confirm("Apagar esta regra?")) return;
    const { error } = await untyped(supabase).from("plate_rules").delete().eq("id", r.id);
    if (error) return void toast.error(error.message);
    void load();
  }

  const now = new Date();
  const host = (u: string) => u.replace(/^https:\/\//, "").split(/[/?#]/)[0];

  return (
    <section className="rounded-2xl border border-border bg-card p-5 card-soft">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 font-display text-lg font-bold"><CalendarClock className="size-5 text-primary" /> Destino por horário e data</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Exemplo: no almoço abre o cardápio, à noite o WhatsApp; a promoção vale só até domingo. O mesmo QR, destinos diferentes.
          </p>
        </div>
        {!adding && <Button size="sm" className="gap-1.5 rounded-xl" onClick={() => setAdding(true)}><Plus className="size-4" /> Nova regra</Button>}
      </div>

      <p className="mt-3 rounded-xl bg-muted p-3 text-xs text-muted-foreground">
        Fora de qualquer regra vale o destino normal{defaultUrl ? <> (<b>{host(defaultUrl)}</b>)</> : ""}. A primeira regra da lista que casar vence. Se o Plus ficar inativo,
        as regras pausam e o destino normal volta a valer: o QR nunca para.
      </p>

      {list && list.length > 0 && (
        <ul className="mt-3 space-y-2">
          {list.map((r) => {
            const live = ruleMatches(r, now);
            return (
              <li key={r.id} className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 ${r.enabled ? "border-border" : "border-dashed border-border opacity-60"}`}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">
                    {r.label || host(r.destination_url)}
                    {live && <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-black text-green-800">VALENDO AGORA</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">{describeRule(r)} → {host(r.destination_url)}</p>
                </div>
                <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={r.enabled} onChange={() => void toggle(r)} /> ligada</label>
                <Button size="icon" variant="ghost" className="size-8 text-destructive hover:bg-destructive/10" aria-label="Apagar regra" onClick={() => void remove(r)}><Trash2 className="size-4" /></Button>
              </li>
            );
          })}
        </ul>
      )}
      {list && list.length === 0 && !adding && <p className="mt-3 text-sm text-muted-foreground">Nenhuma regra ainda. Este código usa sempre o destino normal.</p>}

      {adding && (
        <div className="mt-4 space-y-3 rounded-xl border border-border bg-surface p-4 text-sm">
          <div className="grid gap-2 sm:grid-cols-2">
            <Input value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="Nome da regra (ex.: Cardápio do almoço)" className="h-10 rounded-xl" />
            <Input value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="https://… destino desta regra" className="h-10 rounded-xl" />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Dias (vazio = todos)</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {DAYS.map((d, i) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setF({ ...f, days: f.days.includes(i) ? f.days.filter((x) => x !== i) : [...f.days, i] })}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${f.days.includes(i) ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="text-xs font-semibold text-muted-foreground">Das<Input type="time" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} className="mt-1 h-10 rounded-xl" /></label>
            <label className="text-xs font-semibold text-muted-foreground">Até<Input type="time" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} className="mt-1 h-10 rounded-xl" /></label>
            <label className="text-xs font-semibold text-muted-foreground">Valendo a partir de<Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} className="mt-1 h-10 rounded-xl" /></label>
            <label className="text-xs font-semibold text-muted-foreground">Até o dia<Input type="date" value={f.until} onChange={(e) => setF({ ...f, until: e.target.value })} className="mt-1 h-10 rounded-xl" /></label>
          </div>
          <p className="text-[11px] text-muted-foreground">Horário de Brasília. Janela que passa da meia-noite (ex.: 18:00 até 02:00) funciona.</p>
          <div className="flex gap-2">
            <Button onClick={() => void add()} disabled={busy} className="rounded-xl font-bold">{busy ? "Salvando…" : "Salvar regra"}</Button>
            <Button variant="outline" className="rounded-xl" onClick={() => setAdding(false)}>Cancelar</Button>
          </div>
        </div>
      )}
    </section>
  );
}
