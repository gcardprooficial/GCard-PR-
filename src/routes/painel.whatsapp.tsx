/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePanel } from "@/lib/panelContext";
import {
  getWhatsAppStatus,
  sendWhatsAppQuickReply,
  sendWhatsAppText,
} from "@/lib/whatsapp/whatsapp.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Fluxos } from "@/components/whatsapp/Fluxos";

export const Route = createFileRoute("/painel/whatsapp")({ component: WhatsApp });

// Tabelas novas ainda não estão nos tipos gerados do Supabase.
const db = supabase as any;

type Conv = {
  id: string;
  wa_id: string;
  name: string | null;
  status: "bot" | "humano" | "resolvido";
  unread_count: number;
  last_text: string | null;
  last_message_at: string;
};
type Msg = {
  id: string;
  direction: "in" | "out";
  sender: "cliente" | "bot" | "humano";
  kind: string;
  body: string | null;
  created_at: string;
};
type Quick = {
  id: string;
  title: string;
  keywords: string[];
  body: string;
  audio_path: string | null;
  is_active: boolean;
  sort_order: number;
};
type Know = { id: string; question: string; answer: string; created_at: string };

const STATUS_LABEL = { bot: "Bot", humano: "Atendente", resolvido: "Resolvida" } as const;
const STATUS_STYLE = {
  bot: "bg-g-green/15 text-g-green",
  humano: "bg-primary/25 text-foreground",
  resolvido: "bg-muted text-muted-foreground",
} as const;

const fmtPhone = (w: string) => (w.startsWith("55") && w.length >= 12 ? `+55 ${w.slice(2, 4)} ${w.slice(4)}` : `+${w}`);
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function WhatsApp() {
  const [tab, setTab] = useState<"conversas" | "fluxos" | "respostas" | "ia">("conversas");
  const runStatus = useServerFn(getWhatsAppStatus);
  const [status, setStatus] = useState<{ provider: "zapi" | "meta"; connected: boolean; ai: boolean } | null>(null);

  useEffect(() => {
    runStatus().then(setStatus).catch(() => setStatus(null));
  }, [runStatus]);

  const tabs = [
    ["conversas", "Conversas"],
    ["fluxos", "Fluxos"],
    ["respostas", "Respostas automáticas"],
    ["ia", "IA e conhecimento"],
  ] as const;

  return (
    <div>
      <h1 className="text-2xl">WhatsApp</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Caixa de entrada compartilhada, respostas automáticas e IA. Quando o cliente pede atendente ou o bot não sabe,
        a conversa vira <strong>Atendente</strong> e o bot fica quieto até você devolver.
      </p>

      {status && !status.connected && (
        <div className="mt-4 rounded-2xl border border-primary/40 bg-primary/10 p-4 text-sm">
          <strong>WhatsApp ainda não conectado.</strong>{" "}
          {status.provider === "zapi" ? (
            <>
              Falta <code>ZAPI_WEBHOOK_SECRET</code> na Vercel (e apontar o webhook da instância pra{" "}
              <code>/api/webhooks/zapi?secret=…</code>).
            </>
          ) : (
            <>
              Defina na Vercel: <code>ZAPI_INSTANCE_ID</code> + <code>ZAPI_TOKEN</code> + <code>ZAPI_WEBHOOK_SECRET</code>{" "}
              (Z-API, recomendado) ou as variáveis <code>WHATSAPP_*</code> (API oficial da Meta).
            </>
          )}{" "}
          Passo a passo em <code>docs/WHATSAPP-ZAPI.md</code>.
        </div>
      )}
      {status && !status.ai && (
        <p className="mt-2 text-xs text-muted-foreground">
          IA desligada: falta <code>GEMINI_API_KEY</code> (Google) ou <code>ANTHROPIC_API_KEY</code>. Sem ela, o bot só usa as respostas automáticas e passa o
          resto pra equipe.
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {tabs.map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
              tab === k ? "bg-foreground text-white" : "bg-card text-muted-foreground hover:bg-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === "conversas" && <Conversas />}
        {tab === "fluxos" && <Fluxos />}
        {tab === "respostas" && <Respostas />}
        {tab === "ia" && <IA />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function Conversas() {
  const { userId } = usePanel();
  const send = useServerFn(sendWhatsAppText);
  const sendQuick = useServerFn(sendWhatsAppQuickReply);
  const [convs, setConvs] = useState<Conv[]>([]);
  const [filter, setFilter] = useState<"todas" | "humano" | "bot" | "resolvido">("todas");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [quicks, setQuicks] = useState<Quick[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const loadConvs = useCallback(async () => {
    const { data } = await db.from("wa_conversations").select("*").order("last_message_at", { ascending: false }).limit(200);
    setConvs((data ?? []) as Conv[]);
  }, []);

  const loadMsgs = useCallback(async (id: string) => {
    const { data } = await db.from("wa_messages").select("*").eq("conversation_id", id).order("created_at");
    setMsgs((data ?? []) as Msg[]);
  }, []);

  useEffect(() => {
    void loadConvs();
    db.from("wa_quick_replies").select("*").eq("is_active", true).order("sort_order").then(({ data }: any) =>
      setQuicks((data ?? []) as Quick[]),
    );
    const ch = supabase
      .channel("wa-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "wa_messages" }, () => {
        void loadConvs();
        setActiveId((cur) => {
          if (cur) void loadMsgs(cur);
          return cur;
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "wa_conversations" }, () => void loadConvs())
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [loadConvs, loadMsgs]);

  useEffect(() => {
    if (!activeId) return;
    void loadMsgs(activeId);
    void db.from("wa_conversations").update({ unread_count: 0 }).eq("id", activeId);
  }, [activeId, loadMsgs]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const active = convs.find((c) => c.id === activeId) ?? null;
  const shown = useMemo(() => convs.filter((c) => filter === "todas" || c.status === filter), [convs, filter]);
  const waiting = convs.filter((c) => c.status === "humano").length;

  async function setStatus(status: Conv["status"]) {
    if (!active) return;
    const { error } = await db.from("wa_conversations").update({ status }).eq("id", active.id);
    if (error) toast.error(error.message);
    else void loadConvs();
  }

  async function submit() {
    if (!active || !text.trim()) return;
    setSending(true);
    try {
      await send({ data: { conversationId: active.id, text: text.trim() } });
      setText("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui enviar.");
    } finally {
      setSending(false);
    }
  }

  async function submitQuick(id: string) {
    if (!active || !id) return;
    setSending(true);
    try {
      await sendQuick({ data: { conversationId: active.id, quickReplyId: id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui enviar.");
    } finally {
      setSending(false);
    }
  }

  async function teach(index: number) {
    const answer = msgs[index]?.body;
    if (!answer) return;
    let question = "";
    for (let i = index - 1; i >= 0; i--) {
      if (msgs[i]!.direction === "in" && msgs[i]!.body) {
        question = msgs[i]!.body!;
        break;
      }
    }
    const q = window.prompt("Pergunta do cliente que essa resposta responde:", question);
    if (!q?.trim()) return;
    const { error } = await db.from("wa_knowledge").insert({ question: q.trim(), answer, created_by: userId });
    if (error) toast.error(error.message);
    else toast.success("Ensinado! A IA passa a usar essa resposta.");
  }

  const stale =
    active && msgs.length
      ? Date.now() - new Date([...msgs].reverse().find((m) => m.direction === "in")?.created_at ?? 0).getTime() >
        24 * 3600 * 1000
      : false;

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      {/* Lista */}
      <div className={`rounded-2xl bg-card p-3 card-soft ${active ? "hidden lg:block" : ""}`}>
        <div className="flex flex-wrap gap-1.5 pb-3">
          {(
            [
              ["todas", "Todas"],
              ["humano", `Atendente${waiting ? ` (${waiting})` : ""}`],
              ["bot", "Bot"],
              ["resolvido", "Resolvidas"],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                filter === k ? "bg-foreground text-white" : "bg-muted text-muted-foreground"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="max-h-[65vh] space-y-1 overflow-y-auto">
          {shown.length === 0 && <p className="p-4 text-sm text-muted-foreground">Nenhuma conversa ainda.</p>}
          {shown.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveId(c.id)}
              className={`w-full rounded-xl px-3 py-2.5 text-left transition-colors ${
                c.id === activeId ? "bg-primary/15" : "hover:bg-muted"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-bold">{c.name ?? fmtPhone(c.wa_id)}</span>
                {c.unread_count > 0 && (
                  <span className="rounded-full bg-g-green px-2 py-0.5 text-[11px] font-black text-white">
                    {c.unread_count}
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{c.last_text}</p>
              <div className="mt-1 flex items-center justify-between">
                <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-black ${STATUS_STYLE[c.status]}`}>
                  {STATUS_LABEL[c.status]}
                </span>
                <span className="text-[10px] text-muted-foreground">{fmtTime(c.last_message_at)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Conversa */}
      <div className={`flex min-h-[60vh] flex-col rounded-2xl bg-card card-soft ${active ? "" : "hidden lg:flex"}`}>
        {!active ? (
          <p className="m-auto p-6 text-sm text-muted-foreground">Escolha uma conversa.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
              <button type="button" className="text-sm font-bold lg:hidden" onClick={() => setActiveId(null)}>
                ← Voltar
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{active.name ?? "Sem nome"}</p>
                <a
                  className="text-xs text-muted-foreground underline"
                  href={`https://wa.me/${active.wa_id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {fmtPhone(active.wa_id)}
                </a>
              </div>
              <span className={`rounded-md px-2 py-1 text-xs font-black ${STATUS_STYLE[active.status]}`}>
                {STATUS_LABEL[active.status]}
              </span>
              {active.status !== "humano" && (
                <Button size="sm" variant="outline" onClick={() => setStatus("humano")}>
                  Assumir
                </Button>
              )}
              {active.status === "humano" && (
                <Button size="sm" variant="outline" onClick={() => setStatus("bot")}>
                  Devolver ao bot
                </Button>
              )}
              {active.status !== "resolvido" && (
                <Button size="sm" variant="outline" onClick={() => setStatus("resolvido")}>
                  Resolver
                </Button>
              )}
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto p-3" style={{ maxHeight: "50vh" }}>
              {msgs.map((m, i) => (
                <div key={m.id} className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`group max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                      m.direction === "in"
                        ? "bg-muted"
                        : m.sender === "bot"
                          ? "bg-g-green/15"
                          : "bg-primary/25"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.body ?? (m.kind === "audio" ? "🎤 áudio" : `[${m.kind}]`)}</p>
                    <p className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                      {m.direction === "out" ? (m.sender === "bot" ? "🤖 bot" : "👤 equipe") : "cliente"} ·{" "}
                      {fmtTime(m.created_at)}
                      {m.direction === "out" && m.body && (
                        <button type="button" className="font-bold underline" onClick={() => teach(i)}>
                          🎓 ensinar IA
                        </button>
                      )}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>

            {stale && (
              <p className="mx-3 mb-2 rounded-xl bg-primary/15 p-2 text-xs">
                Passou de 24h sem o cliente escrever: a Meta só deixa mandar mensagem livre dentro de 24h. Pode
                falhar o envio.
              </p>
            )}

            <div className="space-y-2 border-t border-border p-3">
              {quicks.length > 0 && (
                <select
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                  value=""
                  onChange={(e) => void submitQuick(e.target.value)}
                  disabled={sending}
                >
                  <option value="">⚡ Enviar resposta pronta (texto + áudio)…</option>
                  {quicks.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.title}
                      {q.audio_path ? " 🎤" : ""}
                    </option>
                  ))}
                </select>
              )}
              <div className="flex gap-2">
                <Input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && void submit()}
                  placeholder="Escreva uma mensagem… (ao enviar, a conversa vira Atendente)"
                  className="h-11"
                />
                <Button onClick={submit} disabled={sending || !text.trim()}>
                  Enviar
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function Respostas() {
  const [rows, setRows] = useState<Quick[]>([]);
  const [editing, setEditing] = useState<Partial<Quick> | null>(null);
  const [kw, setKw] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await db.from("wa_quick_replies").select("*").order("sort_order");
    setRows((data ?? []) as Quick[]);
  }, []);
  useEffect(() => void load(), [load]);

  function edit(r: Partial<Quick> | null) {
    setEditing(r);
    setKw((r?.keywords ?? []).join(", "));
    setFile(null);
  }

  async function save() {
    if (!editing?.title?.trim() || !editing.body?.trim()) {
      toast.error("Preencha título e texto.");
      return;
    }
    setSaving(true);
    try {
      let audio_path = editing.audio_path ?? null;
      if (file) {
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "mp3";
        if (!["ogg", "opus", "mp3", "m4a", "aac", "amr"].includes(ext)) {
          throw new Error("Use áudio .ogg, .mp3, .m4a, .aac ou .amr (o WhatsApp não aceita .webm/.wav).");
        }
        const path = `${crypto.randomUUID()}.${ext}`;
        const up = await supabase.storage.from("wa-audio").upload(path, file, file.type ? { contentType: file.type } : {});
        if (up.error) throw up.error;
        audio_path = path;
      }
      const payload = {
        title: editing.title.trim(),
        body: editing.body.trim(),
        keywords: kw.split(",").map((k) => k.trim()).filter(Boolean),
        audio_path,
        is_active: editing.is_active ?? true,
        sort_order: editing.sort_order ?? rows.length + 1,
      };
      const { error } = editing.id
        ? await db.from("wa_quick_replies").update(payload).eq("id", editing.id)
        : await db.from("wa_quick_replies").insert(payload);
      if (error) throw error;
      toast.success("Salvo.");
      edit(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : (e as { message?: string }).message ?? "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Apagar essa resposta?")) return;
    await db.from("wa_quick_replies").delete().eq("id", id);
    void load();
  }

  async function toggle(r: Quick) {
    await db.from("wa_quick_replies").update({ is_active: !r.is_active }).eq("id", r.id);
    void load();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Se a mensagem do cliente tiver uma das <strong>palavras-chave</strong>, o bot manda o texto (e o áudio, se
        tiver). Use <code>{"{{precos}}"}</code> e <code>{"{{modelos}}"}</code> no texto: são preenchidos ao vivo com o
        catálogo do site, então preço nunca fica desatualizado.
      </p>

      <Button onClick={() => edit({ is_active: true })}>+ Nova resposta</Button>

      {editing && (
        <div className="space-y-3 rounded-2xl bg-card p-4 card-soft">
          <Input
            placeholder="Título (ex.: Valores)"
            value={editing.title ?? ""}
            onChange={(e) => setEditing({ ...editing, title: e.target.value })}
          />
          <Input
            placeholder="Palavras-chave separadas por vírgula (ex.: preço, valor, quanto custa)"
            value={kw}
            onChange={(e) => setKw(e.target.value)}
          />
          <textarea
            className="min-h-32 w-full rounded-xl border border-border bg-background p-3 text-sm"
            placeholder="Texto da resposta"
            value={editing.body ?? ""}
            onChange={(e) => setEditing({ ...editing, body: e.target.value })}
          />
          <div>
            <p className="text-xs font-bold">Áudio com a sua voz (opcional)</p>
            <input type="file" accept=".ogg,.opus,.mp3,.m4a,.aac,.amr,audio/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {editing.audio_path && !file && <p className="mt-1 text-xs text-muted-foreground">Já tem áudio salvo. Envie outro pra trocar.</p>}
            <p className="mt-1 text-[11px] text-muted-foreground">
              Grave no celular e envie como .m4a/.mp3 (ou .ogg pra chegar como mensagem de voz).
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving}>
              {saving ? "Salvando…" : "Salvar"}
            </Button>
            <Button variant="outline" onClick={() => edit(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className={`rounded-2xl bg-card p-4 card-soft ${r.is_active ? "" : "opacity-50"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-bold">
                {r.title} {r.audio_path && "🎤"}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => toggle(r)}>
                  {r.is_active ? "Desativar" : "Ativar"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => edit(r)}>
                  Editar
                </Button>
                <Button size="sm" variant="outline" onClick={() => remove(r.id)}>
                  Apagar
                </Button>
              </div>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Palavras: {r.keywords.join(", ") || "—"}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm">{r.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function IA() {
  const { userId } = usePanel();
  const [enabled, setEnabled] = useState(true);
  const [rows, setRows] = useState<Know[]>([]);
  const [q, setQ] = useState("");
  const [a, setA] = useState("");

  const load = useCallback(async () => {
    const [s, k] = await Promise.all([
      db.from("app_settings").select("value").eq("key", "wa_ai").maybeSingle(),
      db.from("wa_knowledge").select("*").order("created_at", { ascending: false }),
    ]);
    setEnabled(s.data?.value?.enabled !== false);
    setRows((k.data ?? []) as Know[]);
  }, []);
  useEffect(() => void load(), [load]);

  async function toggle() {
    const next = !enabled;
    const { error } = await db.from("app_settings").upsert({ key: "wa_ai", value: { enabled: next } });
    if (error) {
      toast.error(error.message);
      return;
    }
    setEnabled(next);
  }

  async function add() {
    if (!q.trim() || !a.trim()) return;
    const { error } = await db.from("wa_knowledge").insert({ question: q.trim(), answer: a.trim(), created_by: userId });
    if (error) {
      toast.error(error.message);
      return;
    }
    setQ("");
    setA("");
    void load();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-card p-4 card-soft">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-bold">Resposta por IA</p>
            <p className="text-sm text-muted-foreground">
              Quando nenhuma resposta automática bate, a IA responde usando só: o catálogo ao vivo do site, os fatos
              da empresa e as respostas abaixo. Se não souber, ela chama a equipe — nunca inventa.
            </p>
          </div>
          <Button variant={enabled ? "default" : "outline"} onClick={toggle}>
            {enabled ? "Ligada" : "Desligada"}
          </Button>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl bg-card p-4 card-soft">
        <p className="font-bold">Ensinar uma resposta</p>
        <p className="text-xs text-muted-foreground">
          Dica: nas conversas, clique em “🎓 ensinar IA” em qualquer resposta boa que a equipe deu.
        </p>
        <Input placeholder="Pergunta do cliente" value={q} onChange={(e) => setQ(e.target.value)} />
        <textarea
          className="min-h-24 w-full rounded-xl border border-border bg-background p-3 text-sm"
          placeholder="Resposta certa"
          value={a}
          onChange={(e) => setA(e.target.value)}
        />
        <Button onClick={add}>Adicionar</Button>
      </div>

      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="rounded-2xl bg-card p-4 card-soft">
            <p className="text-sm font-bold">P: {r.question}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm">R: {r.answer}</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={async () => {
                await db.from("wa_knowledge").delete().eq("id", r.id);
                void load();
              }}
            >
              Apagar
            </Button>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted-foreground">Nada ensinado ainda.</p>}
      </div>
    </div>
  );
}
