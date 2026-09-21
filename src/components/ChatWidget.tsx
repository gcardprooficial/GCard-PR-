import { useEffect, useMemo, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { getChat, sendChatMessage, createVisitorToken } from "@/lib/chat.functions";

type ChatMessage = {
  id: string;
  sender_type: "visitor" | "staff";
  sender_name?: string | null;
  body: string;
  created_at: string;
};

const TOKEN_KEY = "gcard_chat_visitor_token";

export function ChatWidget() {
  const getChatFn = useServerFn(getChat);
  const sendMessageFn = useServerFn(sendChatMessage);
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [body, setBody] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const existing = window.localStorage.getItem(TOKEN_KEY) ?? createVisitorToken();
    window.localStorage.setItem(TOKEN_KEY, existing);
    setToken(existing);
  }, []);

  async function load() {
    if (!token) return;
    try {
      const result = await getChatFn({ data: { visitorToken: token } });
      setMessages((result.messages ?? []) as ChatMessage[]);
    } catch (error) {
      console.error("Falha ao carregar chat", error);
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 12000);
    return () => window.clearInterval(timer);
  }, [token]);

  const hasUnread = useMemo(
    () => messages.some((item) => item.sender_type === "staff"),
    [messages],
  );

  async function send() {
    if (!body.trim() || !token || busy) return;
    setBusy(true);
    try {
      const result = await sendMessageFn({
        data: {
          visitorToken: token,
          body: body.trim(),
          visitorName: name.trim() || null,
          visitorEmail: email.trim() || null,
        },
      });
      setMessages((current) => [...current, result.message as ChatMessage]);
      setBody("");
    } catch (error) {
      console.error(error);
      toast.error("Não conseguimos enviar agora. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open ? (
        <section className="flex w-[min( calc(100vw-2rem),380px)] flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl shadow-foreground/15">
          <header className="flex items-center justify-between bg-foreground px-5 py-4 text-white">
            <div>
              <p className="text-sm font-bold">Fale com a GCard-PRÓ</p>
              <p className="mt-0.5 text-xs text-white/60">A equipe responde por aqui</p>
            </div>
            <button
              aria-label="Fechar chat"
              onClick={() => setOpen(false)}
              className="rounded-xl p-2 hover:bg-white/10"
            >
              <X className="size-5" />
            </button>
          </header>
          <div className="flex h-80 flex-col gap-3 overflow-y-auto bg-surface p-4">
            {!loaded ? (
              <p className="m-auto text-sm text-muted-foreground">Carregando conversa…</p>
            ) : null}
            {loaded && messages.length === 0 ? (
              <div className="m-auto max-w-[260px] text-center">
                <p className="font-semibold">Olá. Como podemos ajudar?</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Tire dúvidas sobre produtos, pedido ou pagamento.
                </p>
              </div>
            ) : null}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`max-w-[86%] rounded-2xl px-3.5 py-2.5 text-sm ${message.sender_type === "visitor" ? "self-end rounded-br-md bg-primary text-primary-foreground" : "self-start rounded-bl-md bg-card text-foreground shadow-sm"}`}
              >
                {message.sender_type === "staff" ? (
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-primary">
                    Equipe
                  </p>
                ) : null}
                <p className="whitespace-pre-wrap break-words">{message.body}</p>
              </div>
            ))}
          </div>
          <div className="space-y-2 border-t border-border bg-card p-3">
            <div className="grid grid-cols-2 gap-2">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Seu nome"
                className="h-9 rounded-xl border border-input bg-background px-3 text-xs outline-none focus:ring-2 focus:ring-primary/30"
              />
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                placeholder="Seu e-mail"
                className="h-9 rounded-xl border border-input bg-background px-3 text-xs outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="flex items-end gap-2">
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
                rows={2}
                maxLength={4000}
                placeholder="Escreva sua mensagem…"
                className="min-h-10 flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                aria-label="Enviar mensagem"
                onClick={() => void send()}
                disabled={busy || !body.trim()}
                className="btn-press flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="size-4" />
              </button>
            </div>
          </div>
        </section>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="btn-press relative flex items-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 hover:bg-accent"
          aria-label="Abrir atendimento"
        >
          <MessageCircle className="size-5" />
          Atendimento
          {hasUnread ? (
            <span className="absolute -right-1 -top-1 size-3 rounded-full border-2 border-background bg-red-500" />
          ) : null}
        </button>
      )}
    </div>
  );
}
