import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { chatGet, chatSend, type ChatMessage } from "@/lib/chat.functions";
import { WHATSAPP_CONTACTS, whatsappLink } from "@/lib/contact";

// Chat do site (balão no canto): nome e e-mail só na primeira mensagem; depois a conversa continua no mesmo navegador.
// A equipe responde pelo painel ou pelo Hub. Fora do horário, a resposta vem no próximo dia útil.

const TOKEN_KEY = "gcard-chat-token";

function newToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function readToken(): string | null {
  try {
    let t = localStorage.getItem(TOKEN_KEY);
    if (!t) {
      t = newToken();
      localStorage.setItem(TOKEN_KEY, t);
    }
    return t;
  } catch {
    return null;
  }
}

const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [started, setStarted] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setToken(readToken());
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const r = await chatGet({ data: { token } });
      setMessages(r.messages);
      setStarted(r.started);
    } catch {
      /* tenta de novo no próximo ciclo */
    }
  }, [token]);

  useEffect(() => {
    if (!open || !token) return;
    void load();
    const id = setInterval(() => {
      if (!document.hidden) void load();
    }, 7000);
    return () => clearInterval(id);
  }, [open, token, load]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length, open]);

  const send = async () => {
    if (!token || busy) return;
    const message = text.trim();
    if (!message) return;
    setBusy(true);
    setError("");
    try {
      const r = await chatSend({
        data: { token, message, ...(started ? {} : { name: name.trim(), email: email.trim() }) },
      });
      if (!r.ok) {
        setError(r.error);
      } else {
        setText("");
        await load();
      }
    } catch {
      setError("Não consegui enviar agora. Chame no WhatsApp.");
    }
    setBusy(false);
  };

  if (!token) return null;
  const wa = WHATSAPP_CONTACTS[0];

  return (
    <div className="v2" style={{ display: "contents" }}>
      {open ? (
        <section
          aria-label="Chat de suporte"
          className="card col"
          style={{
            position: "fixed",
            right: 16,
            bottom: 16,
            width: "min(360px, calc(100vw - 32px))",
            height: "min(520px, calc(100vh - 32px))",
            zIndex: 60,
            padding: 0,
            gap: 0,
            overflow: "hidden",
            boxShadow: "0 12px 40px rgba(0,0,0,.25)",
          }}
        >
          <header
            className="row between"
            style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)" }}
          >
            <div className="col" style={{ gap: 0 }}>
              <b className="sm">Fale com a gente</b>
              <span className="xs muted">Respondemos em dias úteis, das 9h às 17h</span>
            </div>
            <button
              type="button"
              className="btn ghost"
              style={{ padding: 4 }}
              aria-label="Fechar o chat"
              onClick={() => setOpen(false)}
            >
              <X size={18} />
            </button>
          </header>
          <div className="col grow" style={{ padding: 14, gap: 8, overflowY: "auto" }}>
            {messages.length === 0 && (
              <p className="sm muted" style={{ margin: 0 }}>
                Oi! Conte sua dúvida sobre kits, pedidos ou ativação. Se for urgente, chame no
                WhatsApp
                {wa ? (
                  <>
                    {" "}
                    <a
                      href={whatsappLink(wa.number)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="accent"
                    >
                      com {wa.name.replace(/\s*\|.*/, "")}
                    </a>
                  </>
                ) : null}
                .
              </p>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className="col"
                style={{
                  alignItems: m.sender_type === "visitor" ? "flex-end" : "flex-start",
                  gap: 2,
                }}
              >
                <div
                  className="sm"
                  style={{
                    maxWidth: "85%",
                    padding: "8px 12px",
                    borderRadius: 14,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    background:
                      m.sender_type === "visitor"
                        ? "var(--accent, #f59e0b)"
                        : "var(--soft, rgba(0,0,0,.06))",
                    color: m.sender_type === "visitor" ? "#1a1200" : "inherit",
                  }}
                >
                  {m.body}
                </div>
                <span className="xs muted">
                  {m.sender_type === "visitor" ? "Você" : "Equipe"} · {hhmm(m.created_at)}
                </span>
              </div>
            ))}
            <div ref={end} />
          </div>
          <footer
            className="col"
            style={{ padding: 12, gap: 8, borderTop: "1px solid var(--line)" }}
          >
            {!started && (
              <div className="row" style={{ gap: 8 }}>
                <input
                  className="input grow"
                  aria-label="Seu nome"
                  placeholder="Seu nome"
                  value={name}
                  maxLength={80}
                  onChange={(e) => setName(e.target.value)}
                  style={{ minWidth: 0 }}
                />
                <input
                  className="input grow"
                  aria-label="Seu e-mail"
                  type="email"
                  placeholder="Seu e-mail"
                  value={email}
                  maxLength={160}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ minWidth: 0 }}
                />
              </div>
            )}
            {error && (
              <span role="alert" className="xs" style={{ color: "var(--danger)" }}>
                {error}
              </span>
            )}
            <div className="row" style={{ gap: 8 }}>
              <input
                className="input grow"
                aria-label="Sua mensagem"
                placeholder="Digite sua mensagem"
                value={text}
                maxLength={2000}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                style={{ minWidth: 0 }}
              />
              <button
                type="button"
                className="btn primary"
                aria-label="Enviar"
                disabled={
                  busy ||
                  !text.trim() ||
                  (!started && (name.trim().length < 2 || !email.includes("@")))
                }
                onClick={() => void send()}
              >
                <Send size={16} />
              </button>
            </div>
            {!started && (
              <span className="xs muted">Usamos seu e-mail só para responder esta conversa.</span>
            )}
          </footer>
        </section>
      ) : (
        <button
          type="button"
          className="btn primary"
          aria-label="Abrir o chat de suporte"
          onClick={() => setOpen(true)}
          style={{
            position: "fixed",
            right: 16,
            bottom: 16,
            zIndex: 60,
            borderRadius: 999,
            padding: "12px 16px",
            boxShadow: "0 8px 24px rgba(0,0,0,.25)",
          }}
        >
          <MessageCircle size={18} /> Suporte
        </button>
      )}
    </div>
  );
}
