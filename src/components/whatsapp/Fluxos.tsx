/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Tabelas novas ainda não estão nos tipos gerados do Supabase.
const db = supabase as any;

type NodeType = "text" | "audio" | "buttons" | "ask" | "cep" | "condition" | "ai" | "handoff" | "models" | "goto";
type FNode = {
  type: NodeType;
  text?: string;
  audio_path?: string | null;
  buttons?: { id: string; title: string; next: string | null }[];
  save_as?: string;
  keywords?: string[];
  next?: string | null;
  yes?: string | null;
  no?: string | null;
  target?: string;
};
type FlowRow = {
  id: string;
  name: string;
  is_active: boolean;
  trigger: { type: string; keywords?: string[]; button_id?: string };
  start: string | null;
  nodes: Record<string, FNode>;
  sort_order: number;
};

const NODE_META: Record<NodeType, { icon: string; label: string; color: string }> = {
  text: { icon: "💬", label: "Enviar texto", color: "border-g-green/50" },
  audio: { icon: "🎤", label: "Enviar áudio", color: "border-primary/60" },
  buttons: { icon: "🔘", label: "Botões (até 3)", color: "border-blue-400/60" },
  ask: { icon: "❓", label: "Perguntar e guardar resposta", color: "border-purple-400/60" },
  cep: { icon: "📍", label: "Pedir CEP e calcular prazo", color: "border-orange-400/60" },
  condition: { icon: "🔀", label: "Condição (palavra-chave)", color: "border-pink-400/60" },
  ai: { icon: "🤖", label: "Resposta da IA", color: "border-cyan-400/60" },
  handoff: { icon: "🙋", label: "Passar pra atendente", color: "border-red-400/60" },
  models: { icon: "🖼️", label: "Enviar modelos com foto", color: "border-teal-400/60" },
  goto: { icon: "↩️", label: "Voltar ao início do fluxo", color: "border-zinc-400/60" },
};

const TRIGGERS = [
  ["first_message", "Primeira mensagem do cliente"],
  ["keyword", "Palavra-chave na mensagem"],
  ["audio", "Cliente mandou áudio"],
  ["image", "Cliente mandou imagem"],
  ["button", "Cliente clicou num botão (id)"],
  ["any_text", "Qualquer texto (último recurso)"],
] as const;

const newId = () => `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

function defaultNode(type: NodeType): FNode {
  switch (type) {
    case "text":
      return { type, text: "", next: null };
    case "audio":
      return { type, audio_path: null, next: null };
    case "buttons":
      return {
        type,
        text: "Escolha uma opção:",
        buttons: [
          { id: `b${newId()}`, title: "Opção 1", next: null },
          { id: `b${newId()}`, title: "Opção 2", next: null },
        ],
      };
    case "ask":
      return { type, text: "Qual o seu nome?", save_as: "nome", next: null };
    case "cep":
      return { type, text: "Me manda o seu CEP que eu calculo o prazo saindo de Indaiatuba/SP 📍", next: null };
    case "condition":
      return { type, keywords: [], yes: null, no: null };
    case "ai":
      return { type, next: null };
    case "models":
      return { type, text: "Nossos modelos 👇", next: null };
    case "goto":
      return { type, target: "start" };
    default:
      return { type: "handoff", text: "Certo! Já chamei alguém da equipe pra te responder por aqui 🙂" };
  }
}

const childrenOf = (n: FNode): (string | null | undefined)[] => [
  n.next,
  n.target && n.target !== "start" ? n.target : null,
  n.yes,
  n.no,
  ...(n.buttons ?? []).map((b) => b.next),
];

function AddNode({ onAdd }: { onAdd: (type: NodeType) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-xl border-2 border-dashed border-border px-3 py-2 text-xs font-bold text-muted-foreground hover:border-primary hover:text-foreground"
      >
        + Adicionar passo
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-60 rounded-xl border border-border bg-card p-1 shadow-xl">
          {(Object.keys(NODE_META) as NodeType[]).map((t) => (
            <button
              key={t}
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
              onClick={() => {
                setOpen(false);
                onAdd(t);
              }}
            >
              <span>{NODE_META[t].icon}</span>
              {NODE_META[t].label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Fluxos() {
  const [flows, setFlows] = useState<FlowRow[]>([]);
  const [draft, setDraft] = useState<FlowRow | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await db.from("wa_flows").select("*").order("sort_order");
    setFlows((data ?? []) as FlowRow[]);
  }, []);
  useEffect(() => void load(), [load]);

  function create() {
    setDraft({
      id: "",
      name: "Novo fluxo",
      is_active: true,
      trigger: { type: "keyword", keywords: [] },
      start: null,
      nodes: {},
      sort_order: flows.length + 1,
    });
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      // Só grava nós alcançáveis a partir do início (descarta sobras de nós removidos).
      const keep: Record<string, FNode> = {};
      const walk = (id?: string | null) => {
        if (!id || keep[id] || !draft.nodes[id]) return;
        keep[id] = draft.nodes[id]!;
        childrenOf(keep[id]!).forEach(walk);
      };
      walk(draft.start);
      const payload = {
        name: draft.name.trim() || "Fluxo",
        is_active: draft.is_active,
        trigger: draft.trigger,
        start: draft.start,
        nodes: keep,
        sort_order: draft.sort_order,
      };
      const { data, error } = draft.id
        ? await db.from("wa_flows").update(payload).eq("id", draft.id).select("*").single()
        : await db.from("wa_flows").insert(payload).select("*").single();
      if (error) throw error;
      toast.success("Fluxo salvo.");
      setDraft(data as FlowRow);
      void load();
    } catch (e) {
      toast.error((e as { message?: string }).message ?? "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!draft?.id || !window.confirm("Apagar esse fluxo?")) return;
    await db.from("wa_flows").delete().eq("id", draft.id);
    setDraft(null);
    void load();
  }

  const patchNode = (id: string, patch: Partial<FNode>) =>
    setDraft((d) => (d ? { ...d, nodes: { ...d.nodes, [id]: { ...d.nodes[id]!, ...patch } } } : d));

  const addNode = (type: NodeType, attach: (id: string) => void) => {
    const id = newId();
    setDraft((d) => (d ? { ...d, nodes: { ...d.nodes, [id]: defaultNode(type) } } : d));
    attach(id);
  };

  const removeNode = (id: string, detach: () => void) => {
    setDraft((d) => {
      if (!d) return d;
      const nodes = { ...d.nodes };
      const drop = (nid?: string | null) => {
        if (!nid || !nodes[nid]) return;
        const n = nodes[nid]!;
        delete nodes[nid];
        childrenOf(n).forEach(drop);
      };
      drop(id);
      return { ...d, nodes };
    });
    detach();
  };

  async function uploadAudio(id: string, file: File) {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "mp3";
    if (!["ogg", "opus", "mp3", "m4a", "aac", "amr"].includes(ext)) {
      toast.error("Use áudio .ogg, .mp3, .m4a, .aac ou .amr.");
      return;
    }
    const path = `${crypto.randomUUID()}.${ext}`;
    const up = await supabase.storage.from("wa-audio").upload(path, file, file.type ? { contentType: file.type } : {});
    if (up.error) {
      toast.error(up.error.message);
      return;
    }
    patchNode(id, { audio_path: path });
    toast.success("Áudio anexado (salve o fluxo).");
  }

  function chain(id: string | null | undefined, attach: (id: string | null) => void): React.ReactNode {
    const node = id ? draft?.nodes[id] : null;
    if (!id || !node) return <AddNode onAdd={(t) => addNode(t, attach)} />;
    const meta = NODE_META[node.type];
    const hasText = ["text", "ask", "cep", "buttons", "handoff", "models"].includes(node.type);

    return (
      <div className="flex flex-col items-start">
        <div className={`w-72 rounded-2xl border-2 bg-card p-3 shadow-sm ${meta.color}`}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-black">
              {meta.icon} {meta.label}
            </p>
            <button type="button" className="text-xs font-bold text-red-600" onClick={() => removeNode(id, () => attach(null))}>
              remover
            </button>
          </div>

          {hasText && (
            <textarea
              className="mt-2 min-h-20 w-full rounded-lg border border-border bg-background p-2 text-sm"
              value={node.text ?? ""}
              placeholder="Mensagem… ({{nome}} {{precos}} {{modelos}})"
              onChange={(e) => patchNode(id, { text: e.target.value })}
            />
          )}

          {node.type === "ask" && (
            <Input
              className="mt-2 h-9"
              placeholder="Guardar resposta como (ex.: nome)"
              value={node.save_as ?? ""}
              onChange={(e) => patchNode(id, { save_as: e.target.value.replace(/\W/g, "") })}
            />
          )}

          {node.type === "audio" && (
            <div className="mt-2 text-xs">
              <input
                type="file"
                accept=".ogg,.opus,.mp3,.m4a,.aac,.amr,audio/*"
                onChange={(e) => e.target.files?.[0] && void uploadAudio(id, e.target.files[0])}
              />
              <p className="mt-1 text-muted-foreground">{node.audio_path ? "✅ áudio anexado" : "nenhum áudio ainda"}</p>
            </div>
          )}

          {node.type === "condition" && (
            <Input
              className="mt-2 h-9"
              placeholder="Se a mensagem tiver… (palavras separadas por vírgula)"
              value={(node.keywords ?? []).join(", ")}
              onChange={(e) =>
                patchNode(id, { keywords: e.target.value.split(",").map((k) => k.trim()).filter(Boolean) })
              }
            />
          )}

          {node.type === "models" && (
            <p className="mt-2 text-xs text-muted-foreground">
              Manda uma foto de cada modelo ativo, com nome e preço. Fotos ficam em public/wa/.
            </p>
          )}
          {node.type === "goto" && (
            <p className="mt-2 text-xs text-muted-foreground">
              Volta pro primeiro passo do fluxo (o menu), pra o cliente nunca ficar sem opção.
            </p>
          )}

          {node.type === "ai" && (
            <p className="mt-2 text-xs text-muted-foreground">
              A IA responde com base no catálogo e no que a equipe ensinou. Se não souber, chama atendente.
            </p>
          )}
        </div>

        {node.type === "buttons" ? (
          <div className="mt-1 flex items-start gap-4 border-t-2 border-border pt-2">
            {(node.buttons ?? []).map((b, i) => (
              <div key={b.id} className="flex flex-col items-start gap-1">
                <div className="flex items-center gap-1">
                  <Input
                    className="h-8 w-40 text-xs"
                    maxLength={20}
                    value={b.title}
                    onChange={(e) =>
                      patchNode(id, {
                        buttons: (node.buttons ?? []).map((x, j) => (j === i ? { ...x, title: e.target.value } : x)),
                      })
                    }
                  />
                  {(node.buttons ?? []).length > 1 && (
                    <button
                      type="button"
                      className="text-xs font-bold text-red-600"
                      onClick={() => {
                        if (b.next) removeNode(b.next, () => undefined);
                        patchNode(id, { buttons: (node.buttons ?? []).filter((_, j) => j !== i) });
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div className="ml-2 border-l-2 border-border pl-3 pt-1">
                  {chain(b.next, (nid) =>
                    patchNode(id, {
                      buttons: (node.buttons ?? []).map((x, j) => (j === i ? { ...x, next: nid } : x)),
                    }),
                  )}
                </div>
              </div>
            ))}
            {(node.buttons ?? []).length < 3 && (
              <button
                type="button"
                className="rounded-xl border-2 border-dashed border-border px-3 py-2 text-xs font-bold text-muted-foreground"
                onClick={() =>
                  patchNode(id, {
                    buttons: [...(node.buttons ?? []), { id: `b${newId()}`, title: "Nova opção", next: null }],
                  })
                }
              >
                + botão
              </button>
            )}
          </div>
        ) : node.type === "condition" ? (
          <div className="mt-1 flex items-start gap-4 border-t-2 border-border pt-2">
            {(
              [
                ["yes", "✅ Se tiver"],
                ["no", "❌ Se não tiver"],
              ] as const
            ).map(([k, label]) => (
              <div key={k} className="flex flex-col items-start gap-1">
                <span className="text-xs font-black">{label}</span>
                <div className="ml-2 border-l-2 border-border pl-3 pt-1">
                  {chain(node[k], (nid) => patchNode(id, { [k]: nid }))}
                </div>
              </div>
            ))}
          </div>
        ) : node.type === "handoff" || node.type === "goto" ? null : (
          <div className="ml-6 mt-1 border-l-2 border-border pl-3 pt-2">
            {chain(node.next, (nid) => patchNode(id, { next: nid }))}
          </div>
        )}
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Monte o caminho da conversa como no n8n: escolha o <strong>gatilho</strong> e encadeie passos (texto, áudio,
          botões, pergunta, CEP, IA, atendente). Botões e condições abrem ramificações.
        </p>
        <Button onClick={create}>+ Novo fluxo</Button>
        {flows.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setDraft(f)}
            className="flex w-full flex-wrap items-center justify-between gap-2 rounded-2xl bg-card p-4 text-left card-soft"
          >
            <span className="font-bold">{f.name}</span>
            <span className="text-xs text-muted-foreground">
              {TRIGGERS.find(([k]) => k === f.trigger.type)?.[1]} · {f.is_active ? "ativo" : "pausado"} ·{" "}
              {Object.keys(f.nodes).length} passos
            </span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={() => setDraft(null)}>
          ← Fluxos
        </Button>
        <Input className="h-10 max-w-xs" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <Button variant={draft.is_active ? "default" : "outline"} onClick={() => setDraft({ ...draft, is_active: !draft.is_active })}>
          {draft.is_active ? "Ativo" : "Pausado"}
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? "Salvando…" : "Salvar"}
        </Button>
        {draft.id && (
          <Button variant="outline" onClick={remove}>
            Apagar
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl bg-card p-4 card-soft">
        <div className="min-w-max">
          <div className="w-72 rounded-2xl border-2 border-foreground bg-foreground/5 p-3">
            <p className="text-sm font-black">⚡ Gatilho</p>
            <select
              className="mt-2 h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
              value={draft.trigger.type}
              onChange={(e) => setDraft({ ...draft, trigger: { ...draft.trigger, type: e.target.value } })}
            >
              {TRIGGERS.map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
            {(draft.trigger.type === "keyword" || draft.trigger.type === "first_message") && (
              <Input
                className="mt-2 h-9"
                placeholder={draft.trigger.type === "first_message" ? "também abrir quando disser… (menu, opções, ajuda)" : "palavras separadas por vírgula"}
                value={(draft.trigger.keywords ?? []).join(", ")}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    trigger: { ...draft.trigger, keywords: e.target.value.split(",").map((k) => k.trim()).filter(Boolean) },
                  })
                }
              />
            )}
            {draft.trigger.type === "button" && (
              <Input
                className="mt-2 h-9"
                placeholder="id do botão"
                value={draft.trigger.button_id ?? ""}
                onChange={(e) => setDraft({ ...draft, trigger: { ...draft.trigger, button_id: e.target.value } })}
              />
            )}
          </div>
          <div className="ml-6 mt-1 border-l-2 border-border pl-3 pt-2">
            {chain(draft.start, (nid) => setDraft((d) => (d ? { ...d, start: nid } : d)))}
          </div>
        </div>
      </div>
    </div>
  );
}
