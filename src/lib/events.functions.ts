import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { rateLimit, clientKey } from "@/lib/rateLimit";

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
    await trackEvent({ type: data.type, firstTouch, data: { slug: data.slug, ...(data.origin ? { origin: data.origin } : {}) } });
    return { ok: true as const };
  });
