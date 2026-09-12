import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { money } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/painel/clientes")({ component: Customers });

type Contact = {
  email: string;
  name: string;
  phone: string | null;
  orders: number;
  paid: number;
  lastOrder: string;
  consent: boolean;
  unsubscribed: boolean;
  kind: string;
};
type Order = {
  customer_email: string;
  customer_name: string;
  customer_phone: string | null;
  total_cents: number;
  payment_status: string;
  created_at: string;
  marketing_consent_at: string | null;
  kind: string;
};

function Customers() {
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState<"todos" | "consentidos" | "revenda" | "clientes">("todos");

  const load = useCallback(async () => {
    const [ordersResult, marketingResult] = await Promise.all([
      supabase
        .from("orders")
        .select(
          "customer_email, customer_name, customer_phone, total_cents, payment_status, created_at, marketing_consent_at, kind",
        )
        .order("created_at", { ascending: false })
        .limit(5000),
      supabase.from("marketing_contacts").select("email, marketing_unsubscribed_at"),
    ]);
    if (ordersResult.error) {
      toast.error("Não foi possível carregar os clientes.");
      return;
    }
    const unsubscribed = new Set(
      (marketingResult.data ?? []).filter((x) => x.marketing_unsubscribed_at).map((x) => x.email),
    );
    const map = new Map<string, Contact>();
    for (const order of (ordersResult.data ?? []) as Order[]) {
      const current = map.get(order.customer_email);
      const next: Contact = current ?? {
        email: order.customer_email,
        name: order.customer_name,
        phone: order.customer_phone,
        orders: 0,
        paid: 0,
        lastOrder: order.created_at,
        consent: false,
        unsubscribed: unsubscribed.has(order.customer_email),
        kind: order.kind,
      };
      next.orders += 1;
      if (order.payment_status === "pago") next.paid += order.total_cents;
      if (order.marketing_consent_at) next.consent = true;
      if (new Date(order.created_at) > new Date(next.lastOrder)) next.lastOrder = order.created_at;
      map.set(order.customer_email, next);
    }
    setContacts(
      [...map.values()].sort(
        (a, b) => new Date(b.lastOrder).getTime() - new Date(a.lastOrder).getTime(),
      ),
    );
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(
    () =>
      (contacts ?? []).filter((contact) => {
        const text = `${contact.name} ${contact.email} ${contact.phone ?? ""}`.toLowerCase();
        const matchesQuery = !query || text.includes(query.toLowerCase());
        const matchesSegment =
          segment === "todos" ||
          (segment === "consentidos" && contact.consent && !contact.unsubscribed) ||
          (segment === "revenda" && contact.kind === "revenda") ||
          (segment === "clientes" && contact.paid > 0);
        return matchesQuery && matchesSegment;
      }),
    [contacts, query, segment],
  );

  const consented = (contacts ?? []).filter((x) => x.consent && !x.unsubscribed).length;
  const revenue = (contacts ?? []).reduce((sum, x) => sum + x.paid, 0);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">
            Relacionamento
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Clientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Uma visão simples do histórico e do consentimento de cada contato.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void load()}>
          Atualizar
        </Button>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Summary label="Contatos" value={String(contacts?.length ?? 0)} />
        <Summary label="Consentidos" value={String(consented)} />
        <Summary label="Receita paga" value={money(revenue)} />
      </div>
      <div className="mt-6 rounded-3xl bg-card p-5 card-soft sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, e-mail ou telefone"
            className="h-11 lg:max-w-md"
          />
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["todos", "Todos"],
                ["clientes", "Compradores"],
                ["consentidos", "Consentimento LGPD"],
                ["revenda", "Revenda"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSegment(key)}
                className={`rounded-full px-3 py-2 text-xs font-semibold ${segment === key ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-3">Cliente</th>
                <th className="px-3 py-3">Pedidos</th>
                <th className="px-3 py-3">Pago</th>
                <th className="px-3 py-3">Último pedido</th>
                <th className="px-3 py-3">Marketing</th>
                <th className="px-3 py-3">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((contact) => (
                <tr key={contact.email} className="hover:bg-secondary/40">
                  <td className="px-3 py-4">
                    <p className="font-semibold">{contact.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {contact.email}
                      {contact.phone ? ` · ${contact.phone}` : ""}
                    </p>
                  </td>
                  <td className="px-3 py-4">{contact.orders}</td>
                  <td className="px-3 py-4 font-semibold">{money(contact.paid)}</td>
                  <td className="px-3 py-4 text-muted-foreground">
                    {new Date(contact.lastOrder).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-3 py-4">
                    {contact.unsubscribed ? (
                      <span className="rounded-full bg-red-100 px-2 py-1 text-xs text-red-700">
                        Descadastrado
                      </span>
                    ) : contact.consent ? (
                      <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-700">
                        Consentido
                      </span>
                    ) : (
                      <span className="rounded-full bg-secondary px-2 py-1 text-xs text-muted-foreground">
                        Transacional
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-4">
                    <Link
                      to="/painel"
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      Ver pedidos
                    </Link>
                  </td>
                </tr>
              ))}
              {contacts && visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-sm text-muted-foreground">
                    Nenhum contato encontrado para este filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-card p-5 card-soft">
      <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
    </div>
  );
}
