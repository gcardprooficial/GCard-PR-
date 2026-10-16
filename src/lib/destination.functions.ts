import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { untyped } from "@/lib/db-untyped";
import { rateLimitShared } from "@/lib/rateLimit";
import { checkDestination, isPublicHost, normalizeDestination, type DestinationRule } from "@/lib/destination";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return untyped(supabaseAdmin);
}

export type ReleaseRequest = {
  id: string;
  plate_id: string;
  short_code: string;
  url: string;
  host: string;
  requester_email: string;
  status: "pendente" | "aprovado_dominio" | "aprovado_endereco" | "negado";
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
};

/** Cliente logado pede liberação de um site para o destino de um código dele. Grava o pedido e avisa a equipe por e-mail. */
export const requestDestinationRelease = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ plateId: z.string().uuid(), url: z.string().trim().min(8).max(2000) }).parse(input))
  .handler(async ({ data, context }) => {
    if (!(await rateLimitShared(`dest-req:${context.userId}`, 5, 3_600_000))) {
      return { ok: false as const, error: "Muitos pedidos seguidos. Aguarde um pouco." };
    }
    const n = normalizeDestination(data.url);
    if (!n.ok) return { ok: false as const, error: n.reason };

    // O código precisa ser do cliente: a leitura com o login dele passa pela RLS de plates.
    const { data: plate } = await untyped(context.supabase).from("plates").select("id, short_code").eq("id", data.plateId).maybeSingle();
    if (!plate) return { ok: false as const, error: "Código não encontrado na sua conta." };

    const db = await admin();
    const [{ data: rules }, { data: urls }] = await Promise.all([
      db.from("allowed_destination_hosts").select("host, include_subdomains"),
      db.from("allowed_destination_urls").select("url"),
    ]);
    const already = checkDestination(n.url, (rules ?? []) as DestinationRule[], ((urls ?? []) as { url: string }[]).map((u) => u.url));
    if (already.ok) return { ok: true as const, status: "ja_liberado" as const };

    const host = new URL(n.url).hostname;
    const email = String((context.claims as { email?: string }).email ?? "").toLowerCase();
    const { error } = await db.from("destination_requests").insert({
      plate_id: plate.id,
      short_code: plate.short_code,
      url: n.url,
      host,
      requester_id: context.userId,
      requester_email: email || "(sem e-mail)",
    });
    if (error) {
      // índice único: já existe um pedido pendente igual para este código.
      if ((error as { code?: string }).code === "23505") return { ok: true as const, status: "ja_pedido" as const };
      console.error("falha ao gravar pedido de liberação", error);
      return { ok: false as const, error: "Não consegui registrar o pedido agora. Tente de novo." };
    }
    const { notifyAdminDestinationRequest } = await import("@/lib/email-events.server");
    await notifyAdminDestinationRequest({ shortCode: plate.short_code, url: n.url, host, requesterEmail: email });
    return { ok: true as const, status: "pedido_enviado" as const };
  });

export const listReleaseRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertTeam } = await import("@/lib/team.server");
    await assertTeam(context.userId);
    const { data, error } = await (await admin())
      .from("destination_requests")
      .select("id, plate_id, short_code, url, host, requester_email, status, decided_at, decision_note, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error("Não consegui carregar os pedidos.");
    return (data ?? []) as ReleaseRequest[];
  });

/** Equipe decide: libera o site inteiro, só o endereço exato, ou nega. Só decide pedido ainda pendente. */
export const decideReleaseRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        decision: z.enum(["dominio", "endereco", "negar"]),
        includeSubdomains: z.boolean().default(false),
        note: z.string().trim().max(300).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertTeam } = await import("@/lib/team.server");
    await assertTeam(context.userId);
    const db = await admin();
    const { data: req } = await db
      .from("destination_requests")
      .select("id, url, host, status, short_code, requester_email")
      .eq("id", data.id)
      .maybeSingle();
    if (!req) throw new Error("Pedido não encontrado.");
    if (req.status !== "pendente") throw new Error("Esse pedido já foi decidido.");

    if (data.decision === "dominio") {
      if (!isPublicHost(req.host) || !/^[a-z0-9.-]+$/.test(req.host)) throw new Error("Endereço inválido.");
      const { error } = await db
        .from("allowed_destination_hosts")
        .upsert({ host: req.host, include_subdomains: data.includeSubdomains, note: "Liberado por pedido de cliente" }, { onConflict: "host" });
      if (error) throw new Error("Não consegui liberar o site.");
    } else if (data.decision === "endereco") {
      const { error } = await db
        .from("allowed_destination_urls")
        .upsert({ url: req.url, note: "Liberado por pedido de cliente", created_by: context.userId }, { onConflict: "url" });
      if (error) throw new Error("Não consegui liberar o endereço.");
    }
    const status = data.decision === "dominio" ? "aprovado_dominio" : data.decision === "endereco" ? "aprovado_endereco" : "negado";
    const { error } = await db
      .from("destination_requests")
      .update({ status, decided_by: context.userId, decided_at: new Date().toISOString(), decision_note: data.note || null })
      .eq("id", data.id)
      .eq("status", "pendente");
    if (error) throw new Error("Não consegui salvar a decisão.");
    // Avisa o cliente (falha de e-mail não desfaz a decisão).
    if (/.+@.+\..+/.test(req.requester_email)) {
      const { sendDestinationDecisionEmail } = await import("@/lib/email-events.server");
      await sendDestinationDecisionEmail({
        to: req.requester_email,
        shortCode: req.short_code,
        url: req.url,
        approved: data.decision !== "negar",
      });
    }
    return { ok: true as const };
  });

export type HistoryRow = {
  id: string;
  short_code: string | null;
  old_url: string | null;
  new_url: string | null;
  changed_by_email: string | null;
  changed_by_role: "usuario" | "equipe" | "sistema";
  changed_at: string;
};

/** Histórico de destinos (todos, ou de um código). Só equipe. */
export const listDestinationHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ code: z.string().trim().toUpperCase().max(20).optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const { assertTeam } = await import("@/lib/team.server");
    await assertTeam(context.userId);
    let q = (await admin())
      .from("destination_history")
      .select("id, short_code, old_url, new_url, changed_by_email, changed_by_role, changed_at")
      .order("changed_at", { ascending: false })
      .limit(100);
    if (data.code) q = q.ilike("short_code", `%${data.code.replace(/[%,()]/g, "")}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error("Não consegui carregar o histórico.");
    return (rows ?? []) as HistoryRow[];
  });
