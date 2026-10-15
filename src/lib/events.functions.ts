import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { rateLimit, clientKey } from "@/lib/rateLimit";

/** Eventos que o navegador pode avisar (só visualização de produto; os demais saem do servidor/banco). */
export const trackClientEvent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ type: z.literal("produto_visto"), slug: z.string().trim().min(2).max(60) }).parse(input),
  )
  .handler(async ({ data }) => {
    if (!rateLimit(`ev:${clientKey(getRequest())}`, 30, 60_000)) return { ok: false as const };
    const { trackEvent, firstTouchFromRequest } = await import("@/lib/events.server");
    await trackEvent({ type: data.type, firstTouch: firstTouchFromRequest(), data: { slug: data.slug } });
    return { ok: true as const };
  });
