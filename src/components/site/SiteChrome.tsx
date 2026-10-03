import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { PIX_DISCOUNT_DEADLINE, PIX_DISCOUNT_PCT, pixDiscountActive } from "@/lib/promo";
import { WHATSAPP_CONTACTS, whatsappLink } from "@/lib/contact";
import { COMPANY, COMPANY_ADDRESS } from "@/lib/company";
import logoMarca from "@/assets/logo/header-marca.png";
import logoIcone from "@/assets/logo/header-icone.png";

function useCountdown(deadline: string) {
  const [msLeft, setMsLeft] = useState(() => new Date(deadline).getTime() - Date.now());
  useEffect(() => {
    const id = setInterval(() => setMsLeft(new Date(deadline).getTime() - Date.now()), 1000);
    return () => clearInterval(id);
  }, [deadline]);
  return msLeft;
}

/** Faixa temporária -- 5% no Pix + frete grátis, com cronômetro real até o prazo da promo. */
export function PromoBar() {
  const msLeft = useCountdown(PIX_DISCOUNT_DEADLINE);
  if (!pixDiscountActive()) return null;
  const totalSeconds = Math.max(0, Math.floor(msLeft / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="bg-primary text-primary-foreground">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 py-2 text-center text-xs font-bold sm:text-sm">
        <span>
          💸 <strong>{PIX_DISCOUNT_PCT}% OFF no Pix</strong>
        </span>
        <span className="hidden opacity-40 sm:inline">·</span>
        <span>🚚 Frete grátis para todo o Brasil</span>
        <span className="hidden opacity-40 sm:inline">·</span>
        <span className="font-mono tabular-nums">
          Termina em {days > 0 ? `${days}d ` : ""}
          {pad(hours)}:{pad(minutes)}:{pad(seconds)}
        </span>
      </div>
    </div>
  );
}

const NAV = [
  { label: "Início", to: "/", hash: undefined },
  { label: "Produtos", to: "/produtos", hash: undefined },
  { label: "Seja um revendedor", to: "/", hash: "revendedor" },
  { label: "Como funciona", to: "/", hash: "como-funciona" },
  { label: "Para o seu negócio", to: "/", hash: "seu-negocio" },
  { label: "Dúvidas", to: "/", hash: "duvidas" },
  { label: "Contato", to: "/", hash: "contato" },
] as const;

const navLinkClass =
  "whitespace-nowrap text-[13px] font-semibold text-white/70 transition-colors hover:text-white";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-foreground text-white">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-5">
        <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label="GCard-PRÓ — início">
          <img src={logoIcone} alt="" className="h-9 w-auto sm:h-10" draggable={false} />
          <img src={logoMarca} alt="GCard-PRÓ" className="hidden h-6 w-auto md:block" draggable={false} />
        </Link>

        <nav className="hidden items-center gap-5 xl:flex" aria-label="Principal">
          {NAV.map((item) => (
            <Link key={item.label} to={item.to} {...(item.hash ? { hash: item.hash } : {})} className={navLinkClass}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2.5">
          <Link
            to="/ativar"
            className="inline-flex h-11 items-center whitespace-nowrap rounded-xl bg-primary px-3.5 text-[13px] sm:text-sm font-bold text-primary-foreground transition-transform active:scale-[0.97] sm:px-5"
          >
            Acessar painel
          </Link>
          <Link
            to="/comprar"
            search={{}}
            className="hidden h-11 items-center rounded-xl border border-white/25 px-5 text-sm font-bold text-white transition-colors hover:bg-white/10 md:inline-flex"
          >
            Comprar agora
          </Link>

          <Sheet>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Abrir menu"
                className="flex size-10 items-center justify-center rounded-xl text-white hover:bg-white/10 xl:hidden"
              >
                <Menu className="size-7" />
              </button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="flex w-[88vw] max-w-sm flex-col border-0 bg-foreground p-0 text-white [&>button]:hidden"
            >
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <div className="flex h-[72px] items-center justify-between border-b border-white/10 px-5">
                <img src={logoMarca} alt="GCard-PRÓ" className="h-6 w-auto" draggable={false} />
                <SheetClose asChild>
                  <button type="button" aria-label="Fechar menu" className="flex size-11 items-center justify-center rounded-xl hover:bg-white/10">
                    <X className="size-6" />
                  </button>
                </SheetClose>
              </div>
              <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Menu">
                {NAV.map((item) => (
                  <SheetClose asChild key={item.label}>
                    <Link
                      to={item.to}
                      {...(item.hash ? { hash: item.hash } : {})}
                      className="block rounded-xl px-4 py-3.5 text-lg font-semibold text-white/85 hover:bg-white/10 hover:text-white"
                    >
                      {item.label}
                    </Link>
                  </SheetClose>
                ))}
              </nav>
              <div className="space-y-3 border-t border-white/10 p-5">
                <SheetClose asChild>
                  <Link
                    to="/comprar"
                    search={{}}
                    className="flex h-14 items-center justify-center rounded-xl bg-primary text-base font-bold text-primary-foreground"
                  >
                    Comprar agora
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link
                    to="/ativar"
                    className="flex h-14 items-center justify-center rounded-xl border border-white/25 text-base font-bold text-white"
                  >
                    Acessar painel
                  </Link>
                </SheetClose>
                {WHATSAPP_CONTACTS.map((c) => (
                  <a
                    key={c.number}
                    href={whatsappLink(c.number)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-center text-sm font-semibold text-white/60"
                  >
                    WhatsApp {c.display}
                  </a>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

const footerLink =
  "text-sm text-white/65 transition-colors hover:text-white hover:underline underline-offset-4";

export function SiteFooter() {
  return (
    <footer className="bg-foreground text-white">
      <div className="mx-auto max-w-7xl px-5 py-14">
        <div className="grid gap-10 md:grid-cols-[1.3fr_2fr]">
          <div>
            <Link to="/" className="inline-flex items-center gap-2.5" aria-label="GCard-PRÓ — início">
              <img src={logoIcone} alt="" className="h-10 w-auto" draggable={false} />
              <img src={logoMarca} alt="GCard-PRÓ" className="h-6 w-auto" draggable={false} />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/65">
              Fornecedor de cartões NFC e placas QR Code/NFC que levam seus clientes direto à avaliação do Google.
            </p>
            <p className="mt-4 text-xs text-white/45">© {new Date().getFullYear()} GCard-PRÓ</p>
            <p className="mt-1 max-w-xs text-xs leading-relaxed text-white/45">
              {COMPANY.legalName} · CNPJ {COMPANY.cnpj}
              <br />
              {COMPANY_ADDRESS}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            <div>
              <h4 className="text-xs font-black uppercase tracking-[0.18em] text-primary">Produto</h4>
              <ul className="mt-4 space-y-3">
                <li>
                  <Link to="/produtos" className={footerLink}>
                    Todos os produtos
                  </Link>
                </li>
                <li>
                  <Link to="/comprar" search={{ caminho: "lojista" }} className={footerLink}>
                    Para a minha loja
                  </Link>
                </li>
                <li>
                  <Link to="/comprar" search={{ caminho: "revenda" }} className={footerLink}>
                    Revender lotes
                  </Link>
                </li>
                <li>
                  <Link to="/guia" className={footerLink}>
                    Guia NFC e cartão digital
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-[0.18em] text-primary">Suporte</h4>
              <ul className="mt-4 space-y-3">
                <li>
                  <a href="https://instagram.com/gcardpro.oficial" target="_blank" rel="noopener noreferrer" className={footerLink}>
                    Instagram
                  </a>
                </li>
                {WHATSAPP_CONTACTS.map((c) => (
                  <li key={c.number}>
                    <a href={whatsappLink(c.number)} target="_blank" rel="noopener noreferrer" className={footerLink}>
                      WhatsApp {c.name} · {c.display}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-[0.18em] text-primary">Legal</h4>
              <ul className="mt-4 space-y-3">
                <li>
                  <Link to="/termos" className={footerLink}>
                    Termos de uso
                  </Link>
                </li>
                <li>
                  <Link to="/privacidade" className={footerLink}>
                    Política de privacidade
                  </Link>
                </li>
                <li>
                  <Link to="/ativar" className={footerLink}>
                    Ativar meus códigos (revendedor)
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <ul className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/10 pt-6 text-xs font-semibold text-white/60">
          {[
            "Compra segura: Mercado Pago ou InfinitePay",
            "Pix, cartão e boleto",
            "Site protegido por HTTPS",
            "Seus dados protegidos (LGPD)",
            "7 dias para desistir (CDC)",
            "Frete grátis para todo o Brasil",
          ].map((t) => (
            <li key={t} className="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary" aria-hidden>
                <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z" />
                <polyline points="9 12 11 14 15 10" />
              </svg>
              {t}
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
