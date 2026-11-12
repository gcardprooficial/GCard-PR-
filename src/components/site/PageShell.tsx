import type { ReactNode } from "react";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";

/** Moldura das páginas soltas (pagamento, relatório, etc.): fundo e cabeçalho do desenho novo, conteúdo centralizado. */
export function PageShell({ children, width = 520 }: { children: ReactNode; width?: number }) {
  return (
    <div className="v2">
      <div className="lp">
        <div className="lp-bg" aria-hidden="true"><i className="b1" /><i className="b2" /><i className="b3" /></div>
        <SiteHeader />
        <main className="lp-col" style={{ padding: "36px 0 72px", display: "flex", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: width }}>{children}</div>
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}
