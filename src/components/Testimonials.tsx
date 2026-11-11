// Prints reais de clientes (WhatsApp/Instagram), com nomes e telefones tapados. Basta soltar o arquivo em
// src/assets/depoimentos/ (webp/png/jpg): a galeria lê a pasta sozinha, em ordem de nome.
const PRINTS = Object.entries(import.meta.glob("../assets/depoimentos/*.{webp,png,jpg,jpeg}", { eager: true, import: "default" }))
  .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
  .map(([, src]) => src as string);

const QUOTES = [
  {
    text: "Muito obrigado pelo produto 100% confiável! E ainda dão todo o suporte necessário.",
    author: "@artify.social",
    context: "Cliente, via Instagram",
  },
  {
    text: "Passando pra dizer que hoje fiz minha primeira venda com as plaquinhas. Obrigada pela informação, to bem feliz!",
    author: "Revendedora parceira",
    context: "Via WhatsApp",
  },
] as const;

/** Depoimentos reais, recebidos por WhatsApp/Instagram. Nada inventado. */
export function Testimonials() {
  return (
    <section className="lp-sec" aria-label="Depoimentos">
      <div className="lp-head2 rv"><div className="lp-label">Quem já usa</div><h2 className="lp-h2">O que os clientes estão dizendo.</h2></div>

      <div className="gl-grid rv" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", marginTop: 12 }}>
        {QUOTES.map((q) => (
          <blockquote key={q.author} className="card col" style={{ gap: 10, margin: 0 }}>
            <div aria-hidden style={{ color: "var(--brand)", letterSpacing: 2 }}>★★★★★</div>
            <p style={{ margin: 0 }}>“{q.text}”</p>
            <footer className="sm muted"><b style={{ color: "var(--ink)" }}>{q.author}</b> · {q.context}</footer>
          </blockquote>
        ))}
      </div>

      {PRINTS.length > 0 && (
        <div className="rv" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10, marginTop: 14 }}>
          {PRINTS.map((src, i) => (
            <a key={src} href={src} target="_blank" rel="noopener noreferrer" className="card" style={{ display: "block", padding: 0, overflow: "hidden", borderRadius: 14 }} title="Abrir em tamanho grande">
              <img src={src} alt={`Depoimento real de cliente ${i + 1}`} loading="lazy" draggable={false} style={{ display: "block", width: "100%", aspectRatio: "3 / 4", objectFit: "cover", objectPosition: "top" }} />
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
