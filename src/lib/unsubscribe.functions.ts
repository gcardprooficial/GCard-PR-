import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { rateLimit, clientKey } from "@/lib/rateLimit";

const tokenSchema = z.object({ token: z.string().uuid() });

/** Mostra de quem é o link (e-mail mascarado). Não altera nada. */
export const getUnsubscribeInfo = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => tokenSchema.parse(input))
  .handler(async ({ data }) => {
    if (!rateLimit(`unsub-info:${clientKey(getRequest())}`, 20, 600_000)) return { ok: false as const };
    const { describeUnsubscribe } = await import("@/lib/unsubscribe.server");
    const info = await describeUnsubscribe(data.token);
    return info ? { ok: true as const, email: info.email } : { ok: false as const };
  });

/** O clique no botão da página /sair. Só aqui (POST) o descadastro acontece. */
export const confirmUnsubscribe = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => tokenSchema.parse(input))
  .handler(async ({ data }) => {
    if (!rateLimit(`unsub:${clientKey(getRequest())}`, 10, 600_000)) return { ok: false as const };
    const { applyUnsubscribe } = await import("@/lib/unsubscribe.server");
    return applyUnsubscribe(data.token);
  });
