import * as Sentry from "@sentry/tanstackstart-react";

let started = false;

/**
 * Liga o Sentry se houver DSN (VITE_SENTRY_DSN na Vercel). Sem DSN, não faz nada.
 * Sem Replay de propósito: gravaria a tela com CPF/e-mail do cliente (LGPD). Sem dados pessoais por padrão.
 */
export function initSentry() {
  if (started) return;
  const dsn =
    (typeof process !== "undefined" ? process.env?.["SENTRY_DSN"] : undefined) ??
    (import.meta.env["VITE_SENTRY_DSN"] as string | undefined);
  if (!dsn) return;
  started = true;
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
  });
}

export const captureError = (error: unknown) => {
  if (started) Sentry.captureException(error);
};
