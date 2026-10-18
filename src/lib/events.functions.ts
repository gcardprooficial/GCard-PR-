import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { rateLimit, clientKey } from "@/lib/rateLimit";

/**
 * Usuário logado, se houver: confere o token do cabeçalho no Supabase Auth. Qualquer falha (sem token, token
 * inválido, rede, tempo esgotado) = visitante anônimo, e o evento segue como sempre foi.
 */
async function optionalUser(): Promise<{ id: string; email: string | null } | null> {
  try {
    const token = getRequest().headers.get("authorization")?.replace(/^Bearer /i, "");
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!token || !url || !key) return null;
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: key, authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(3_000),
    });
    if (!res.ok) return null;
    const user = (await res.json()) as { id?: unknown; email?: unknown };
    if (typeof user.id !== "string") return null;
    return { id: user.id, email: typeof user.email === "string" ? user.email.toLowerCase() : null };
  } catch {
    return null;
  }
}

/** Eventos que o navegador pode avisar (só visualização de produto; os demais saem do servidor/banco). */
export const trackClientEvent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        type: z.literal("produto_visto"),
        slug: z.string().trim().min(2).max(60),
        // Quem chegou pelo atalho do kit para personalizar.
        origin: z.literal("personalizar").optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (!rateLimit(`ev:${clientKey(getRequest())}`, 30, 60_000)) return { ok: false as const };
    const { trackEvent, firstTouchFromRequest } = await import("@/lib/events.server");
    let firstTouch = firstTouchFromRequest();
    // A origem do atalho só preenche quando não há campanha anterior (first-touch nunca é sobrescrito).
    if (data.origin && !firstTouch?.utm_source) firstTouch = { ...(firstTouch ?? {}), utm_source: data.origin };
    // Logado: o evento leva a pessoa (e o e-mail), para chegar identificado ao hub. Anônimo: como sempre.
    const user = await optionalUser();
    await trackEvent({
      type: data.type,
      firstTouch,
      ...(user ? { personId: user.id, email: user.email } : {}),
      data: { slug: data.slug, ...(data.origin ? { origin: data.origin } : {}) },
    });
    return { ok: true as const };
  });
