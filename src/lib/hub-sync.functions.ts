import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Estado do hub para a tela Integrações (só equipe). Nunca devolve o segredo nem o endereço. */
export const getHubStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertTeam } = await import("@/lib/team.server");
    await assertTeam(context.userId);
    const { hubConfig, hubOutboxEnabled, hubSyncEnabled } = await import("@/lib/hub-sync.server");
    return { configured: hubConfig() !== null, outbox: hubOutboxEnabled(), sync: hubSyncEnabled() };
  });

/** Teste manual: envia 2 contas FICTÍCIAS à rota de carga e mostra a resposta. Funciona mesmo com a carga diária desligada. */
export const testHubSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertTeam } = await import("@/lib/team.server");
    await assertTeam(context.userId);
    const { hubConfig, postBatch, testRecords } = await import("@/lib/hub-sync.server");
    const cfg = hubConfig();
    if (!cfg) return { ok: false as const, status: null, linhas: null, motivo: "hub_nao_configurado" as const };
    const r = await postBatch(testRecords(), cfg);
    return { ok: r.ok && r.status === 200, status: r.status, linhas: r.linhas, motivo: null };
  });
