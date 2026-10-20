import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { untyped } from "@/lib/db-untyped";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return untyped(supabaseAdmin);
}

/** Confere que o código está num lote que pertence a quem chamou. Devolve o código e o lote. */
async function ownedPlate(db: ReturnType<typeof untyped>, plateId: string, userId: string) {
  const { data: plate } = await db
    .from("plates")
    .select("id, short_code, batch_id, plus_created")
    .eq("id", plateId)
    .maybeSingle();
  if (!plate?.batch_id) throw new Error("Código não encontrado.");
  const { data: batch } = await db.from("batches").select("id, owner_user_id, quantity").eq("id", plate.batch_id).maybeSingle();
  if (!batch || batch.owner_user_id !== userId) throw new Error("Esse código não é seu.");
  return { plate, batch } as { plate: { id: string; short_code: string; batch_id: string; plus_created: boolean }; batch: { id: string; quantity: number } };
}

/**
 * Tirar um código da minha conta.
 * - Código criado por mim (Plus): é só meu, então some (apaga).
 * - Código que veio da GCard: NUNCA apaga. Volta limpo para o estoque (sem dono, sem destino, sem leituras) para ser usado por outra pessoa.
 */
export const releasePlate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ plateId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { plate, batch } = await ownedPlate(db, data.plateId, context.userId);

    if (plate.plus_created) {
      const { error } = await db.from("plates").delete().eq("id", plate.id);
      if (error) throw new Error("Não foi possível remover agora.");
    } else {
      const { error } = await db
        .from("plates")
        .update({
          batch_id: null,
          order_id: null,
          status: "nao_ativada",
          destination_url: null,
          business_name: null,
          sold_to: null,
          activated_at: null,
          activated_by: null,
          sold_at: null,
          scan_count: 0,
          bot_scan_count: 0,
          last_scan_at: null,
        })
        .eq("id", plate.id);
      if (error) throw new Error("Não foi possível devolver agora.");
      // As leituras eram do dono anterior: o código recomeça do zero para quem receber.
      await db.from("plate_scan_events").delete().eq("plate_id", plate.id);
    }
    await db.from("batches").update({ quantity: Math.max(0, batch.quantity - 1) }).eq("id", batch.id);
    await db.from("audit_log").insert({
      action: plate.plus_created ? "cliente_apagou_qr" : "cliente_devolveu_placa",
      entity: "plates",
      entity_id: plate.id,
      actor_id: context.userId,
      details: { short_code: plate.short_code },
    });
    return { ok: true as const, apagado: plate.plus_created };
  });

/** Dar um nome ao meu lote (ex.: "Cartões da Barbearia"). Só o dono muda. */
export const renameMyBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ batchId: z.string().uuid(), label: z.string().trim().max(60) }).parse(input))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: batch } = await db.from("batches").select("id, owner_user_id").eq("id", data.batchId).maybeSingle();
    if (!batch || batch.owner_user_id !== context.userId) throw new Error("Esse lote não é seu.");
    const { error } = await db.from("batches").update({ label: data.label || null }).eq("id", batch.id);
    if (error) throw new Error("Não foi possível salvar o nome.");
    return { ok: true as const };
  });
