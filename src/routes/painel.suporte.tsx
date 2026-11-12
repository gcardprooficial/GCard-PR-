import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  staffChatList,
  staffChatReply,
  staffChatStatus,
  staffChatThread,
  type ChatConversation,
  type ChatMessage,
} from "@/lib/chat.functions";

export const Route = createFileRoute("/painel/suporte")({ component: ChatDoSite });

type Filter = "aberta" | "fechada" | "todas";
const FILTERS: [Filter, string][] = [
  ["aberta", "Abertas"],
  ["fechada", "Fechadas"],
  ["todas", "Todas"],
];
const when = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Conversas do chat do site: lista de 30 em 30, filtro por situação e resposta direto na tela. */
function ChatDoSite() {
  const list = useServerFn(staffChatList);
  const thread = useServerFn(staffChatThread);
  const reply = useServerFn(staffChatReply);
  const setStatus = useServerFn(staffChatStatus);

  const [filter, setFilter] = useState<Filter>("aberta");
  const [items, setItems] = useState<ChatConversation[] | null>(null);
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(false);
  const [selId, setSelId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  const loadList = useCallback(
    async (p: number, f: Filter, append: boolean) => {
      try {
        const r = await list({ data: { page: p, status: f } });
        setItems((cur) => (append && cur ? [...cur, ...r.items] : r.items));
        setMore(r.more);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível carregar.");
      }
    },
    [list],
  );

  useEffect(() => {
    setPage(0);
    setItems(null);
    void loadList(0, filter, false);
  }, [filter, loadList]);

  const loadThread = useCallback(
    async (id: string) => {
      try {
        setMsgs((await thread({ data: { id } })).messages);
      } catch {
        /* tenta no próximo ciclo */
      }
    },
    [thread],
  );

  useEffect(() => {
    if (!selId) return;
    void loadThread(selId);
    const t = setInterval(() => {
      if (!document.hidden) void loadThread(selId);
    }, 8000);
    return () => clearInterval(t);
  }, [selId, loadThread]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [msgs.length, selId]);

  const sel = items?.find((c) => c.id === selId) ?? null;
  const abertas =
    items?.filter((c) => c.status === "aberta" && c.last_from === "visitor").length ?? 0;

  async function send() {
    const t = text.trim();
    if (!selId || !t || busy) return;
    setBusy(true);
    try {
      await reply({ data: { id: selId, text: t } });
      setText("");
      await loadThread(selId);
      void loadList(0, filter, false);
      setPage(0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível enviar.");
    }
    setBusy(false);
  }

  async function toggle(c: ChatConversation) {
    const next = c.status === "aberta" ? "fechada" : "aberta";
    if (
      next === "fechada" &&
      !window.confirm(
        `Fechar a conversa com ${c.visitor_name ?? "o visitante"}? Se ele escrever de novo, ela volta a ficar aberta.`,
      )
    )
      return;
    try {
      await setStatus({ data: { id: c.id, status: next } });
      toast.success(next === "fechada" ? "Conversa fechada." : "Conversa reaberta.");
      await loadList(0, filter, false);
      setPage(0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível atualizar.");
    }
  }

  return (
    <>
      <h1 className="text-2xl">Chat do site</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Mensagens de quem escreveu pelo balão "Suporte" do site. O Hub também responde por aqui.
        {items ? ` ${abertas} esperando resposta nesta lista.` : ""}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {FILTERS.map(([k, l]) => (
          <Button
            key={k}
            size="sm"
            variant={filter === k ? "default" : "outline"}
            onClick={() => {
              setFilter(k);
              setSelId(null);
            }}
          >
            {l}
          </Button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[320px_1fr]">
        <div className="space-y-2">
          {items === null && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {items?.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma conversa.</p>
          )}
          {items?.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelId(c.id)}
              className={`w-full rounded-2xl border p-3 text-left ${selId === c.id ? "border-primary bg-primary/10" : "border-border bg-card"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <b className="truncate text-sm">{c.visitor_name ?? "Visitante"}</b>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {when(c.last_message_at)}
                </span>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {c.visitor_email ?? "sem e-mail"}
              </p>
              <p className="mt-1 truncate text-xs">
                {c.last_from === "staff" ? "Você: " : ""}
                {c.last_text ?? ""}
              </p>
              {c.status === "aberta" && c.last_from === "visitor" && (
                <span className="mt-1 inline-block rounded-full bg-primary/25 px-2 text-xs font-semibold">
                  Esperando resposta
                </span>
              )}
            </button>
          ))}
          {more && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                const p = page + 1;
                setPage(p);
                void loadList(p, filter, true);
              }}
            >
              Mostrar mais
            </Button>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          {!sel ? (
            <p className="text-sm text-muted-foreground">Escolha uma conversa.</p>
          ) : (
            <div className="flex h-[60vh] flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <b className="block truncate">{sel.visitor_name ?? "Visitante"}</b>
                  <span className="block truncate text-xs text-muted-foreground">
                    {sel.visitor_email}
                  </span>
                </div>
                <Button size="sm" variant="outline" onClick={() => void toggle(sel)}>
                  {sel.status === "aberta" ? "Fechar conversa" : "Reabrir"}
                </Button>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto">
                {msgs.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${m.sender_type === "staff" ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${m.sender_type === "staff" ? "bg-primary/30" : "bg-muted"}`}
                    >
                      {m.body}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {m.sender_type === "staff" ? "Equipe" : "Cliente"} · {when(m.created_at)}
                    </span>
                  </div>
                ))}
                <div ref={end} />
              </div>
              <div className="flex gap-2">
                <Input
                  value={text}
                  maxLength={2000}
                  placeholder="Escreva a resposta"
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                />
                <Button disabled={busy || !text.trim()} onClick={() => void send()}>
                  Enviar
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
