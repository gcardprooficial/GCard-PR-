import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, UserRound, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { WHATSAPP_CONTACTS, whatsappLink } from "@/lib/contact";
import { COMPANY, COMPANY_ADDRESS } from "@/lib/company";
import logoIcone from "@/assets/logo/header-icone.png";
import { BUSINESS_HOURS } from "@/lib/business-hours";

// Cabeçalho, rodapé e avisos do site no desenho do protótipo v2 (classes de proto.css, tudo dentro de .v2).
// O wrapper usa display: contents para o cabeçalho continuar "grudando" no topo ao rolar.

/** Logo: ícone G (amarelo) + nome em tinta com "PRÓ" em dourado, como a marca atual. */
export function GLogo({ size = 24 }: { size?: number }) {
  return (
    <span className="row" style={{ gap: 8 }} role="img" aria-label="GCard-PRÓ">
      <img src={logoIcone} alt="" draggable={false} style={{ height: size + 8, width: "auto" }} />
      <span className="gword" style={{ fontSize: size }}>
        GCard-<span className="goldtext">PRÓ</span>
      </span>
    </span>
  );
}

/** Prazo de entrega por região, contado a partir do envio (produção/despacho só em dia útil). */
export function DeliveryTimes({ className = "" }: { className?: string }) {
  return (
    <div className="v2" style={{ display: "contents" }}>
      <div className={`card col ${className}`} style={{ gap: 8 }}>
        <span className="xs muted" style={{ textTransform: "uppercase", letterSpacing: ".04em", fontWeight: 600 }}>Prazo de entrega depois do envio</span>
        {[
          ["Sul e Sudeste", "2 a 3 dias"],
          ["Centro-Oeste", "cerca de 5 dias"],
          ["Norte e Nordeste", "7 a 8 dias"],
        ].map(([a, b]) => (
          <div key={a} className="row sm"><span className="grow"><b>{a}</b></span><span className="muted">{b}</span></div>
        ))}
        <span className="xs muted">O prazo conta a partir do despacho. Produzimos e despachamos de {BUSINESS_HOURS}.</span>
      </div>
    </div>
  );
}

/** Aviso fixo de prazo no topo do site. */
export function NoticeBar() {
  return (
    <div role="alert" className="gnotice">
      <p className="blink-notice">⚠️ Atenção aos prazos: Compras realizadas aos sábados, domingos ou feriados serão produzidas no dia útil seguinte.</p>
    </div>
  );
}

const NAV = [
  { label: "Produtos", to: "/produtos", hash: undefined },
  { label: "Preços dos kits", to: "/", hash: "precos" },
  { label: "Como funciona", to: "/", hash: "como-funciona" },
  { label: "GCard Plus", to: "/plus", hash: undefined },
  { label: "Gerar link grátis", to: "/gerador", hash: undefined },
  { label: "Dúvidas", to: "/", hash: "duvidas" },
  { label: "Contato", to: "/", hash: "contato" },
] as const;

/** E-mail da pessoa logada (ou null). Só no navegador. */
function useLoggedEmail() {
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setEmail(s?.user.email ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);
  return email;
}

export function SiteHeader() {
  const logged = useLoggedEmail();
  return (
    <div className="v2" style={{ display: "contents" }}>
      <NoticeBar />
      <header className="lp-head">
        <div className="lp-col row between" style={{ padding: "0 20px" }}>
          <Link to="/" className="brand" style={{ padding: 0, textDecoration: "none", color: "inherit" }} aria-label="GCard-PRÓ, início">
            <GLogo />
          </Link>
          <nav className="lp-nav" aria-label="Principal">
            {NAV.slice(0, 6).map((item) => (
              <Link key={item.label} to={item.to} {...(item.hash ? { hash: item.hash } : {})}>{item.label}</Link>
            ))}
          </nav>
          <div className="row" style={{ gap: 6 }}>
            {logged ? (
              <Link to="/ativar" title={`Logado como ${logged}`} className="btn" style={{ padding: "7px 12px", maxWidth: 170 }}>
                <UserRound size={15} /><span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{logged.split("@")[0]}</span>
              </Link>
            ) : (
              <Link to="/ativar" className="btn ghost lp-hide-sm" style={{ padding: "7px 12px" }}>Acessar painel</Link>
            )}
            <Link to="/comprar" search={{}} className="btn primary" style={{ padding: "7px 14px" }}>Comprar</Link>
            <Sheet>
              <SheetTrigger asChild>
                <button type="button" aria-label="Abrir menu" className="btn ghost lp-menu" style={{ padding: 8 }}><Menu size={20} /></button>
              </SheetTrigger>
              <SheetContent side="right" className="flex w-[88vw] max-w-sm flex-col border-0 p-0 [&>button]:hidden">
                <div className="v2" style={{ display: "contents" }}>
                  <div className="gsheet">
                    <SheetTitle className="sr-only">Menu</SheetTitle>
                    <div className="row between" style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)" }}>
                      <GLogo size={20} />
                      <SheetClose asChild><button type="button" aria-label="Fechar menu" className="btn ghost" style={{ padding: 8 }}><X size={20} /></button></SheetClose>
                    </div>
                    <nav className="col" style={{ padding: 12, gap: 2, flex: 1, overflowY: "auto" }} aria-label="Menu">
                      {NAV.map((item) => (
                        <SheetClose asChild key={item.label}>
                          <Link to={item.to} {...(item.hash ? { hash: item.hash } : {})} className="nav" style={{ textDecoration: "none" }}>{item.label}</Link>
                        </SheetClose>
                      ))}
                    </nav>
                    <div className="col" style={{ padding: 16, gap: 10, borderTop: "1px solid var(--line)" }}>
                      <SheetClose asChild><Link to="/comprar" search={{}} className="btn primary block">Comprar agora</Link></SheetClose>
                      <SheetClose asChild><Link to="/ativar" className="btn block">Acessar painel</Link></SheetClose>
                      {logged ? <button type="button" onClick={() => void supabase.auth.signOut()} className="btn ghost sm">Sair ({logged.split("@")[0]})</button> : null}
                      {WHATSAPP_CONTACTS.map((c) => (
                        <a key={c.number} href={whatsappLink(c.number)} target="_blank" rel="noopener noreferrer" className="xs muted center">WhatsApp {c.display}</a>
                      ))}
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
    </div>
  );
}

const SELOS = ["Compra segura: Stone ou InfinitePay", "Pix, cartão e boleto", "Site protegido por HTTPS", "Seus dados protegidos (LGPD)", "7 dias para desistir (CDC)", "Frete grátis para todo o Brasil"];

export function SiteFooter() {
  return (
    <div className="v2" style={{ display: "contents" }}>
      <footer className="lp-foot">
        <div className="lp-col col" style={{ gap: 18, padding: "24px 20px" }}>
          <div className="row between wrap" style={{ gap: 16, alignItems: "flex-start" }}>
            <div className="col" style={{ gap: 8, maxWidth: 340 }}>
              <Link to="/" aria-label="GCard-PRÓ, início" style={{ textDecoration: "none", color: "inherit" }}><GLogo size={20} /></Link>
              <p className="sm muted">Fornecedor de kits de cartões NFC e placas QR Code/NFC para revendedores, que levam o cliente direto à avaliação do Google.</p>
              <p className="xs muted">Atendimento e produção: {BUSINESS_HOURS}. Fechado aos sábados, domingos e feriados.</p>
            </div>
            <div className="row wrap" style={{ gap: 28, alignItems: "flex-start" }}>
              <div className="col" style={{ gap: 6 }}>
                <b className="sm">Produto</b>
                <Link to="/produtos" className="xs muted">Todos os produtos</Link>
                <Link to="/comprar" search={{}} className="xs muted">Comprar kits para revenda</Link>
                <Link to="/gerador" className="xs muted">Gerar link de avaliação grátis</Link>
                <Link to="/guia" className="xs muted">Guia NFC e cartão digital</Link>
              </div>
              <div className="col" style={{ gap: 6 }}>
                <b className="sm">Suporte</b>
                <a href="https://instagram.com/gcardpro.oficial" target="_blank" rel="noopener noreferrer" className="xs muted">Instagram</a>
                {WHATSAPP_CONTACTS.map((c) => (
                  <a key={c.number} href={whatsappLink(c.number)} target="_blank" rel="noopener noreferrer" className="xs muted">WhatsApp {c.name} · {c.display}</a>
                ))}
              </div>
              <div className="col" style={{ gap: 6 }}>
                <b className="sm">Legal</b>
                <Link to="/termos" className="xs muted">Termos de uso</Link>
                <Link to="/trocas-e-devolucoes" className="xs muted">Trocas e devoluções</Link>
                <Link to="/privacidade" className="xs muted">Política de privacidade</Link>
                <Link to="/ativar" className="xs muted">Ativar meus códigos</Link>
              </div>
            </div>
          </div>
          <div className="row wrap xs muted" style={{ gap: "6px 18px", borderTop: "1px solid var(--line)", paddingTop: 14 }}>
            {SELOS.map((t) => <span key={t}>✓ {t}</span>)}
          </div>
          <p className="xs muted">© {new Date().getFullYear()} GCard-PRÓ · {COMPANY.legalName} · CNPJ {COMPANY.cnpj} · {COMPANY_ADDRESS}</p>
        </div>
      </footer>
    </div>
  );
}
