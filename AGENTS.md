# Repository guidance

GCard-PRÓ — NFC/QR review cards for Google reviews. TanStack Start + Supabase.

## Rules

- **Price is authoritative on the server.** `src/lib/checkout.functions.ts` recomputes
  every total from `plans` / `plan_price_tiers`. Never trust amounts from the client.
- **`/r/{token}` must never become an open redirect.** Only the Google hosts in the
  `ALLOWED_HOSTS` allowlist (`src/routes/r.$token.ts`). Validate before every 302.
- **Secrets** (`SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_MAPS_API_KEY`,
  `MERCADOPAGO_ACCESS_TOKEN`) are server-only. Never in `VITE_*`, never committed.
- **RLS on every table.** Role checks go through `app_private.is_team` / `has_role`.
  Roles live in `user_roles`, never on `profiles`.
- Payment must sit behind a `PaymentProvider` interface so the provider can be
  swapped without touching the checkout.
- `scan_events` carry no PII (approx country + device only, no raw IP).

## Layout

- `src/routes/` — file-based routes (`index`, `comprar`, `r.$token`, `painel/*`)
- `src/lib/*.functions.ts` — server functions (ship a client stub; keep secrets out)
- `src/lib/*.server.ts` — server-only modules (safe for top-level secret access)
- `supabase/migrations/` — ordered SQL, RLS + GRANTs from the first migration
