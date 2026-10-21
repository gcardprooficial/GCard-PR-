-- Bipador pelo celular: o PC mostra um QR, o celular abre o link e manda os códigos lidos para o PC. ADITIVA e idempotente.
-- Só o servidor (service_role) lê e escreve: a sessão é um segredo de 32 hex que vale por poucas horas.
-- REVERTER: DROP TABLE IF EXISTS public.scan_session_codes, public.scan_sessions;

CREATE TABLE IF NOT EXISTS public.scan_sessions (
  token        TEXT PRIMARY KEY CHECK (token ~ '^[a-f0-9]{32}$'),
  created_by   UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL,
  phone_seen_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.scan_session_codes (
  id         BIGSERIAL PRIMARY KEY,
  token      TEXT NOT NULL REFERENCES public.scan_sessions (token) ON DELETE CASCADE,
  code       TEXT NOT NULL CHECK (length(code) BETWEEN 2 AND 120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS scan_session_codes_token_idx ON public.scan_session_codes (token, id);

ALTER TABLE public.scan_sessions ENABLE ROW LEVEL SECURITY;       -- sem políticas: só o servidor
ALTER TABLE public.scan_session_codes ENABLE ROW LEVEL SECURITY;  -- sem políticas: só o servidor
REVOKE ALL ON public.scan_sessions, public.scan_session_codes FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.scan_sessions, public.scan_session_codes TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.scan_session_codes_id_seq TO service_role;
