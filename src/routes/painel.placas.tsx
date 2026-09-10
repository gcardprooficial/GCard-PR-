import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePanel } from "./painel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/painel/placas")({ component: Placas });

const STATUS = ["nao_ativada", "ativada", "bloqueada"] as const;
const STATUS_LABEL: Record<string, string> = {
  nao_ativada: "Não ativada",
  ativada: "Ativada",
  bloqueada: "Bloqueada",
};

type Plate = {
  id: string;
  token: string;
  status: string;
  destination_url: string | null;
  scan_count: number;
  last_scan_at: string | null;
  activated_at: string | null;
  products: { name: string } | null;
  orders: { order_number: number; customer_name: string } | null;
  businesses: { name: string; review_url: string } | null;
};

function Placas() {
  const { userId, email } = usePanel();
  const [rows, setRows] = useState<Plate[] | null>(null);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("plates")
      .select(
        "id, token, status, destination_url, scan_count, last_scan_at, activated_at, products(name), orders(order_number, customer_name), businesses(name, review_url)",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      toast.error("Não foi possível carregar as placas.");
      return;
    }
    setRows((data ?? []) as unknown as Plate[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(row: Plate, changes: Record<string, unknown>) {
    const { error } = await supabase.from("plates").update(changes).eq("id", row.id);
    if (error) {
      toast.error("Não foi possível salvar.");
      return;
    }
    await supabase.from("audit_log").insert({
      actor_id: userId,
      actor_email: email,
      action: "update_plate",
      entity: "plates",
      entity_id: row.id,
      details: changes,
    });
    setRows((prev) => prev?.map((r) => (r.id === row.id ? { ...r, ...changes } : r)) ?? null);
    toast.success(`Placa ${row.token} atualizada.`);
  }

  function setStatus(row: Plate, status: string) {
    const dest = row.destination_url ?? row.businesses?.review_url ?? null;
    if (status === "ativada" && !dest) {
      toast.error("Defina o link de avaliação antes de ativar.");
      return;
    }
    void patch(row, {
      status,
      ...(status === "ativada" && !row.activated_at ? { activated_at: new Date().toISOString() } : {}),
    });
  }

  const filtered = (rows ?? []).filter((r) => {
    if (!q.trim()) return true;
    const t = q.toLowerCase();
    return (
      r.token.toLowerCase().includes(t) ||
      r.businesses?.name.toLowerCase().includes(t) ||
      r.orders?.customer_name.toLowerCase().includes(t) ||
      String(r.orders?.order_number ?? "").includes(t)
    );
  });

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl">Placas</h1>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar token, negócio, pedido…"
          className="h-10 w-64"
        />
      </div>

      {rows === null ? (
        <p className="mt-8 text-sm text-muted-foreground">Carregando…</p>
      ) : filtered.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          {rows.length === 0 ? "Nenhuma placa emitida ainda." : "Nada encontrado."}
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {filtered.map((r) => (
            <div key={r.id} className="rounded-2xl bg-card p-5 card-soft">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-sm font-semibold">{r.token}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {r.products?.name ?? "—"}
                    {r.orders ? ` · pedido #${r.orders.order_number} (${r.orders.customer_name})` : ""}
                  </p>
                  {r.businesses && (
                    <p className="text-sm text-muted-foreground">Negócio: {r.businesses.name}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.scan_count} scans
                    {r.last_scan_at
                      ? ` · último ${new Date(r.last_scan_at).toLocaleString("pt-BR")}`
                      : ""}
                  </p>
                </div>
                <select
                  value={r.status}
                  onChange={(e) => setStatus(r, e.target.value)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {STATUS.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-3 border-t border-border pt-3">
                <Label className="text-xs">Link de avaliação (destino)</Label>
                <div className="mt-1 flex gap-2">
                  <Input
                    defaultValue={r.destination_url ?? r.businesses?.review_url ?? ""}
                    placeholder="https://search.google.com/local/writereview?placeid=..."
                    className="h-10"
                    id={`d-${r.id}`}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const el = document.getElementById(`d-${r.id}`) as HTMLInputElement | null;
                      const v = el?.value.trim() || null;
                      if (v && !/^https:\/\/(search\.google\.com|www\.google\.com|google\.com|maps\.google\.com|g\.page)\//.test(v)) {
                        toast.error("O link precisa ser do Google.");
                        return;
                      }
                      void patch(r, { destination_url: v });
                    }}
                  >
                    Salvar
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
