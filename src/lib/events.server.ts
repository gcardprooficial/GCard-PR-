import { getRequest } from "@tanstack/react-start/server";
import { parseFirstTouchCookie, type FirstTouch } from "@/lib/first-touch";
import { untyped } from "@/lib/db-untyped";

export type EventType =
  | "conta_criada"
  | "email_confirmado"
  | "produto_visto"
  | "checkout_iniciado"
  | "pagamento_iniciado"
  | "pedido_pago"
  | "codigo_ativado"
  | "destino_alterado"
  | "qr_baixado"
  | "plus_assinado"
  | "plus_atrasado"
  | "plus_cancelado"
  | "qr_criado";

/** First-touch do cookie da requisição atual (servidor). Nunca confia: o banco limpa de novo. */
export function firstTouchFromRequest(): FirstTouch | null {
  try {
    return parseFirstTouchCookie(getRequest().headers.get("cookie"));
  } catch {
    return null;
  }
}

/** Registro único de evento. dedupe = mesma chave não duplica. Falha aqui nunca derruba o fluxo do cliente. */
export async function trackEvent(input: {
  type: EventType;
  personId?: string | null;
  email?: string | null;
  orderId?: string | null;
  plateId?: string | null;
  firstTouch?: FirstTouch | null;
  data?: Record<string, unknown>;
  dedupe?: string | null;
}): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await untyped(supabaseAdmin).rpc("track_event", {
      _type: input.type,
      _person_id: input.personId ?? null,
      _email: input.email ?? null,
      _order_id: input.orderId ?? null,
      _plate_id: input.plateId ?? null,
      _first_touch: input.firstTouch ?? null,
      _data: input.data ?? {},
      _dedupe: input.dedupe ?? null,
    });
  } catch (error) {
    console.error("trackEvent falhou", { type: input.type, error });
  }
}
