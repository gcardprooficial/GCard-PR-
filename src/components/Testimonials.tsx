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
    <section className="mx-auto max-w-6xl px-5 py-14 md:py-16">
      <div className="text-center">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">
          Quem já usa
        </p>
        <h2 className="mt-3 text-3xl leading-tight sm:text-4xl">
          O que os clientes <span className="highlight-yellow">estão dizendo</span>.
        </h2>
      </div>

      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        {QUOTES.map((q) => (
          <blockquote
            key={q.author}
            className="rounded-3xl border border-border bg-card p-6 card-soft sm:p-7"
          >
            <div className="flex gap-0.5 text-primary" aria-hidden>
              {[0, 1, 2, 3, 4].map((i) => (
                <svg key={i} viewBox="0 0 24 24" className="size-4 fill-current">
                  <path d="M12 2l3 6.5 7 .9-5 4.8 1.2 7-6.2-3.4L5.8 21 7 14.2 2 9.4l7-.9L12 2z" />
                </svg>
              ))}
            </div>
            <p className="mt-4 text-base leading-relaxed text-foreground/90 sm:text-lg">
              “{q.text}”
            </p>
            <footer className="mt-4 text-sm text-muted-foreground">
              <span className="font-bold text-foreground">{q.author}</span> · {q.context}
            </footer>
          </blockquote>
        ))}
      </div>
    </section>
  );
}
