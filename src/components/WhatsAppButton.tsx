import { useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { MessageCircle, X } from "lucide-react";
import { WHATSAPP_CONTACTS, whatsappLink } from "@/lib/contact";

/** Botão flutuante: abre um menu com os dois contatos de WhatsApp. Fora do painel. */
export function WhatsAppButton() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  if (pathname.startsWith("/painel")) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open && (
        <div
          role="menu"
          className="w-64 rounded-2xl border border-border bg-card p-3 shadow-xl shadow-foreground/10"
        >
          <p className="px-2 pb-2 text-sm font-semibold">Falar no WhatsApp</p>
          {WHATSAPP_CONTACTS.map((c) => (
            <a
              key={c.number}
              role="menuitem"
              href={whatsappLink(c.number, "Oi! Vim pelo site da GCard-PRÓ.")}
              target="_blank"
              rel="noopener noreferrer"
              data-analytics-event="whatsapp_click"
              data-analytics-label={c.name}
              className="flex items-center justify-between gap-3 rounded-xl px-2 py-2.5 text-sm transition-colors hover:bg-muted"
            >
              <span className="font-semibold">{c.name}</span>
              <span className="text-muted-foreground">{c.display}</span>
            </a>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Fechar contatos de WhatsApp" : "Falar no WhatsApp"}
        aria-expanded={open}
        className="flex size-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-black/20 transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25D366]"
      >
        {open ? <X className="size-6" /> : <MessageCircle className="size-7" />}
      </button>
    </div>
  );
}
