import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { untyped } from "@/lib/db-untyped";

export type PlusSub = { plan: "mensal" | "anual"; status: string; current_period_end: string | null };

/** enabled = venda liberada (app_settings.gcard_plus). active = esta conta tem assinatura em dia. Ler só; nada aqui derruba placa. */
export function usePlus() {
  const [enabled, setEnabled] = useState(false);
  const [sub, setSub] = useState<PlusSub | null>(null);
  useEffect(() => {
    const db = untyped(supabase);
    void db.rpc("plus_enabled").then(({ data }: { data: boolean | null }) => setEnabled(data === true));
    void db
      .from("plus_subscriptions")
      .select("plan, status, current_period_end")
      .order("updated_at", { ascending: false })
      .limit(1)
      .then(({ data }: { data: PlusSub[] | null }) => setSub(data?.[0] ?? null));
  }, []);
  return { enabled, sub, active: sub?.status === "ativa" };
}
