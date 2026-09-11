import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { Toaster } from "@/components/ui/sonner";
import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center animate-rise">
        <div className="text-[9rem] leading-none font-display font-black tracking-tighter text-primary">
          404
        </div>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          Página não encontrada
        </h2>
        <p className="mt-3 text-base text-muted-foreground">
          Essa página não existe ou foi movida.
        </p>
        <div className="mt-8">
          <Link
            to="/"
            className="btn-press inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3.5 text-base font-semibold text-primary-foreground shadow-sm hover:bg-accent btn-primary-shadow"
          >
            ← Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center animate-rise">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Não foi possível carregar
        </h1>
        <p className="mt-3 text-base text-muted-foreground">
          Algo deu errado do nosso lado. Tente atualizar a página ou volte ao início.
        </p>
        {error?.message ? (
          <pre className="mt-6 max-h-48 overflow-auto rounded-2xl bg-muted p-4 text-left text-xs text-muted-foreground font-mono">
            {error.message}
          </pre>
        ) : null}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="btn-press inline-flex items-center justify-center rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-accent btn-primary-shadow"
          >
            Tentar de novo
          </button>
          <Link
            to="/"
            className="btn-press inline-flex items-center justify-center rounded-2xl border-2 border-border bg-background px-6 py-3 text-sm font-semibold text-foreground hover:border-foreground/40 hover:bg-card"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=5",
      },
      { name: "theme-color", content: "#F7F5F1" },
      { name: "color-scheme", content: "light" },
      { title: "GCard-PRÓ | Cartão NFC para avaliações no Google" },
      {
        name: "description",
        content:
          "Cartão de bolso com NFC que leva seu cliente direto para a avaliação do Google. Chega configurado, sem mensalidade.",
      },
      { name: "author", content: "GCard-PRÓ" },
      { name: "robots", content: "index,follow,max-image-preview:large" },
      ...(import.meta.env.VITE_GOOGLE_SITE_VERIFICATION
        ? [
            {
              name: "google-site-verification",
              content: import.meta.env.VITE_GOOGLE_SITE_VERIFICATION,
            },
          ]
        : []),
      {
        property: "og:title",
        content: "GCard-PRÓ | Mais avaliações no Google em 3 segundos",
      },
      {
        property: "og:description",
        content: "Cartão de bolso NFC já configurado com o link de avaliação do seu negócio.",
      },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "pt_BR" },
      { property: "og:site_name", content: "GCard-PRÓ" },
      { property: "og:image", content: "/og-image.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "628" },
      { property: "og:image:type", content: "image/png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "GCard-PRÓ | Mais avaliações no Google" },
      {
        name: "twitter:description",
        content: "Cartão de bolso NFC já configurado para avaliações no Google.",
      },
      { name: "twitter:image", content: "/og-image.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Unbounded:wght@400;500;600;700;800;900&family=Manrope:wght@300;400;500;600;700;800&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "icon", href: "/favicon-512.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/favicon-512.png" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
        {import.meta.env.VITE_GA4_MEASUREMENT_ID ? (
          <>
            <script
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];window.gtag=function(){dataLayer.push(arguments)};gtag('js',new Date());gtag('config','${import.meta.env.VITE_GA4_MEASUREMENT_ID}');`,
              }}
            />
            <script
              async
              data-ga4={import.meta.env.VITE_GA4_MEASUREMENT_ID}
              src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(import.meta.env.VITE_GA4_MEASUREMENT_ID)}`}
            />
          </>
        ) : null}
        {import.meta.env.VITE_GTM_ID ? (
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.dataset.gtm=i;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${import.meta.env.VITE_GTM_ID}');`,
            }}
          />
        ) : null}
      </head>
      <body className="bg-background antialiased">
        {import.meta.env.VITE_GTM_ID ? (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(import.meta.env.VITE_GTM_ID)}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
              title="Google Tag Manager"
            />
          </noscript>
        ) : null}
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Analytics />
      <Toaster
        theme="light"
        position="top-right"
        toastOptions={{
          classNames: {
            toast:
              "group bg-card border-border text-foreground shadow-lg shadow-foreground/5 ring-0 border rounded-2xl",
            title: "font-semibold text-sm",
            description: "text-muted-foreground text-sm",
            actionButton: "!bg-primary !text-primary-foreground !rounded-xl hover:!bg-accent",
            cancelButton: "!bg-muted !text-muted-foreground !rounded-xl",
            closeButton: "!bg-transparent hover:!bg-muted text-muted-foreground !rounded-xl",
            icon: "text-foreground",
          },
        }}
        richColors
        closeButton
      />
    </QueryClientProvider>
  );
}

function Analytics() {
  useEffect(() => {
    const gaId = import.meta.env.VITE_GA4_MEASUREMENT_ID as string | undefined;
    const gtmId = import.meta.env.VITE_GTM_ID as string | undefined;
    window.dataLayer = window.dataLayer ?? [];
    if (gtmId && !document.querySelector(`script[data-gtm="${gtmId}"]`)) {
      window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
      const script = document.createElement("script");
      script.async = true;
      script.dataset.gtm = gtmId;
      script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(gtmId)}`;
      document.head.appendChild(script);
    }
    if (gaId && !document.querySelector(`script[data-ga4="${gaId}"]`)) {
      const script = document.createElement("script");
      script.async = true;
      script.dataset.ga4 = gaId;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
      document.head.appendChild(script);
      window.gtag = (...args: unknown[]) => window.dataLayer?.push(args);
      window.gtag("js", new Date());
      window.gtag("config", gaId);
    }
    const handleClick = (event: MouseEvent) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>("[data-analytics-event]");
      if (!target) return;
      const eventName = target.dataset.analyticsEvent;
      const params = {
        label: target.dataset.analyticsLabel,
        href: target.getAttribute("href") ?? undefined,
      };
      window.dataLayer?.push({ event: eventName, ...params });
      if (eventName) window.gtag?.("event", eventName, params);
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);
  return null;
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}
