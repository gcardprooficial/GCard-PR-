import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { toast } from "sonner";
import {
  listChatConversations,
  getChatConversation,
  replyToChat,
  closeChat,
} from "@/lib/chat.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Conversation = {
  id: string;
  visitor_name: string | null;
  visitor_email: string | null;
  status: "aberta" | "fechada";
  last_message_at: string;
  created_at: string;
};
type ChatMessage = {
  id: string;
  sender_type: "visitor" | "staff";
  sender_name: string | null;
  body: string;
  created_at: string;
};

export const Route = createFileRoute("/painel/chat")({
  head: () => ({
    meta: [{ title: "Conversas | Painel GCard-PRÓ" }, { name: "robots", content: "noindex" }],
  }),
  component: ChatPanel,
});

function ChatPanel() {
  const listFn = useServerFn(listChatConversations);
  const getFn = useServerFn(getChatConversation);
  const replyFn = useServerFn(replyToChat);
  const closeFn = useServerFn(closeChat);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  async function loadConversations() {
    try {
      setConversations((await listFn()) as Conversation[]);
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível carregar as conversas.");
    } finally {
      setLoading(false);
    }
  }
  async function openConversation(conversation: Conversation) {
    setSelected(conversation);
    try {
      setMessages((await getFn({ data: { conversationId: conversation.id } })) as ChatMessage[]);
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível carregar esta conversa.");
    }
  }
  useEffect(() => {
    void loadConversations();
  }, []);

  async function send() {
    if (!selected || !body.trim() || sending) return;
    setSending(true);
    try {
      const message = await replyFn({ data: { conversationId: selected.id, body: body.trim() } });
      setMessages((current) => [...current, message as ChatMessage]);
      setBody("");
      await loadConversations();
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível enviar a resposta.");
    } finally {
      setSending(false);
    }
  }

  async function close() {
    if (!selected) return;
    try {
      await closeFn({ data: { conversationId: selected.id } });
      const closed = { ...selected, status: "fechada" as const };
      setSelected(closed);
      setConversations((current) => current.map((item) => (item.id === closed.id ? closed : item)));
      toast.success("Conversa encerrada.");
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível encerrar a conversa.");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl">Conversas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Atenda visitantes diretamente pelo site.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void loadConversations()}>
          Atualizar
        </Button>
      </div>
      <div className="mt-7 grid min-h-[600px] overflow-hidden rounded-3xl border border-border bg-card lg:grid-cols-[300px_1fr]">
        <aside className="border-b border-border lg:border-b-0 lg:border-r">
          <div className="border-b border-border px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Todas as conversas
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            {loading ? <p className="p-5 text-sm text-muted-foreground">Carregando…</p> : null}
            {!loading && conversations.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">Nenhuma conversa ainda.</p>
            ) : null}
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => void openConversation(conversation)}
                className={`w-full border-b border-border px-4 py-4 text-left transition-colors hover:bg-surface ${selected?.id === conversation.id ? "bg-primary/10" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-bold">
                    {conversation.visitor_name || "Visitante"}
                  </span>
                  <span
                    className={`size-2 rounded-full ${conversation.status === "aberta" ? "bg-emerald-500" : "bg-muted-foreground/30"}`}
                  />
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {conversation.visitor_email || "Sem e-mail informado"}
                </p>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  {new Date(conversation.last_message_at).toLocaleString("pt-BR")}
                </p>
              </button>
            ))}
          </div>
        </aside>
        <section className="flex min-h-[600px] flex-col">
          {!selected ? (
            <div className="m-auto max-w-xs text-center text-muted-foreground">
              <MessageCircle className="mx-auto size-10 opacity-30" />
              <p className="mt-3 text-sm">Selecione uma conversa para ver as mensagens.</p>
            </div>
          ) : (
            <>
              <header className="flex items-center justify-between border-b border-border px-5 py-4">
                <div>
                  <h2 className="font-bold">{selected.visitor_name || "Visitante"}</h2>
                  <p className="text-xs text-muted-foreground">
                    {selected.visitor_email || "E-mail não informado"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void close()}
                  disabled={selected.status === "fechada"}
                >
                  <X className="mr-1.5 size-4" /> Encerrar
                </Button>
              </header>
              <div className="flex flex-1 flex-col gap-3 overflow-y-auto bg-surface p-5">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${message.sender_type === "staff" ? "self-end bg-primary text-primary-foreground" : "self-start bg-card shadow-sm"}`}
                  >
                    <p className="whitespace-pre-wrap">{message.body}</p>
                    <p className="mt-1 text-[10px] opacity-60">
                      {new Date(message.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                ))}
              </div>
              <div className="flex items-end gap-2 border-t border-border p-4">
                <Input
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void send();
                    }
                  }}
                  placeholder="Escreva uma resposta…"
                  disabled={selected.status === "fechada"}
                />
                <Button
                  onClick={() => void send()}
                  disabled={sending || !body.trim() || selected.status === "fechada"}
                  size="icon"
                >
                  <Send className="size-4" />
                </Button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
