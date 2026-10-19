-- GCard Plus: QR Code próprio. ADITIVA e idempotente. Nada de placa/QR existente é alterado.
--  1) plates.plus_created marca os QRs criados pelo Plus (placas compradas continuam como sempre);
--  2) my_plus_active(): a conta logada tem assinatura em dia?
--  3) plus_create_qr(nome, url): cria 1 código ativado num lote pessoal da conta (QR-xxxx). Sem assinatura: 1 teste grátis.
--     Só funciona com a flag gcard_plus ligada (plus_enabled()). Destino passa pela mesma lista de hosts liberados.
--  4) Regra de ouro: sem Plus em dia, o destino de um QR criado pelo Plus fica CONGELADO (o /r continua redirecionando).
--     Placas compradas não são afetadas. Equipe e servidor passam.
-- REVERTER: DROP TRIGGER IF EXISTS plates_plus_freeze_trg ON public.plates;
--   DROP FUNCTION IF EXISTS public.plates_plus_freeze(), public.plus_create_qr(TEXT, TEXT), public.my_plus_active();
--   ALTER TABLE public.plates DROP COLUMN IF EXISTS plus_created;   (só se nenhuma linha usa)

ALTER TABLE public.plates ADD COLUMN IF NOT EXISTS plus_created BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.my_plus_active()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.plus_subscriptions s
    WHERE s.status = 'ativa' AND s.email = lower(COALESCE(auth.jwt() ->> 'email', ''))
  );
$$;
REVOKE ALL ON FUNCTION public.my_plus_active() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_plus_active() TO authenticated;

CREATE OR REPLACE FUNCTION public.plus_create_qr(_name TEXT, _url TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid   UUID := auth.uid();
  mail  TEXT := lower(COALESCE(auth.jwt() ->> 'email', ''));
  nm    TEXT := left(btrim(COALESCE(_name, '')), 80);
  bcode TEXT;
  bid   UUID;
  n     INTEGER;
  p     public.plates;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Entre na sua conta.'; END IF;
  IF NOT public.plus_enabled() THEN RAISE EXCEPTION 'O GCard Plus ainda não está disponível.'; END IF;
  IF length(nm) < 2 THEN RAISE EXCEPTION 'Informe um nome para o QR Code.'; END IF;
  IF NOT public.is_allowed_destination(_url) THEN RAISE EXCEPTION 'Esse endereço ainda não está liberado para este código.'; END IF;

  SELECT count(*) INTO n FROM public.plates
   WHERE plus_created AND batch_id IN (SELECT id FROM public.batches WHERE owner_user_id = uid);
  IF NOT public.my_plus_active() AND n >= 1 THEN
    RAISE EXCEPTION 'Seu QR Code de teste grátis já foi usado. Assine o Plus para criar mais.';
  END IF;
  IF n >= 500 THEN RAISE EXCEPTION 'Limite de QR Codes atingido. Fale com a gente.'; END IF;

  bcode := 'QR-' || substr(replace(uid::text, '-', ''), 1, 10);
  INSERT INTO public.batches (code, label, quantity, owner_user_id, owner_email, status, notes)
  VALUES (bcode, 'Meus QR Codes', 0, uid, NULLIF(mail, ''), 'vendido', 'plus_qr')
  ON CONFLICT (code) DO NOTHING;
  SELECT id INTO bid FROM public.batches WHERE code = bcode AND owner_user_id = uid;
  IF bid IS NULL THEN RAISE EXCEPTION 'Não foi possível preparar seu lote de QR Codes.'; END IF;

  INSERT INTO public.plates (token, batch_id, status, destination_url, business_name, activated_at, activated_by, plus_created)
  VALUES (replace(gen_random_uuid()::text, '-', ''), bid, 'ativada', _url, nm, now(), uid, true)
  RETURNING * INTO p;
  UPDATE public.batches SET quantity = quantity + 1 WHERE id = bid;

  -- Hub: só o host do destino, nunca a URL inteira.
  PERFORM public.track_event('qr_criado', uid, NULLIF(mail, ''), NULL, p.id, NULL,
    jsonb_build_object('host', substring(_url FROM '^https://([^/?#]*)')), 'qr_criado:' || p.id);

  RETURN jsonb_build_object('token', p.token, 'short_code', p.short_code, 'id', p.id);
END;
$$;
REVOKE ALL ON FUNCTION public.plus_create_qr(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.plus_create_qr(TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.plates_plus_freeze()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR auth.role() = 'supabase_admin' OR auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF app_private.is_team(auth.uid()) THEN RETURN NEW; END IF;
  IF NEW.plus_created IS DISTINCT FROM OLD.plus_created THEN
    RAISE EXCEPTION 'Essa informação não pode ser alterada.';
  END IF;
  IF OLD.plus_created AND NEW.destination_url IS DISTINCT FROM OLD.destination_url AND NOT public.my_plus_active() THEN
    RAISE EXCEPTION 'Seu Plus está inativo: o destino deste QR Code fica como está. Reative o Plus para alterar.';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.plates_plus_freeze() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS plates_plus_freeze_trg ON public.plates;
CREATE TRIGGER plates_plus_freeze_trg BEFORE UPDATE OF destination_url, plus_created ON public.plates
  FOR EACH ROW EXECUTE FUNCTION public.plates_plus_freeze();
