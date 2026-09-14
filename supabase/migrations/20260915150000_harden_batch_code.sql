-- SEGURANCA: codigo de lote (batches.code) tinha so 6 chars hex derivados de
-- uuid (16^6 = ~16.7M combinacoes) + data conhecida (YYMMDD) -- brute-forceable
-- via claim_batch_by_code em horas sem rate limit (RPC vai direto no
-- PostgREST, nao passa pelo rate limit da app). Sobe pra 16 chars hex
-- (16^16, inviavel por forca bruta) em ambas as funcoes que geram codigo.

CREATE OR REPLACE FUNCTION public.create_batch(
  _label TEXT, _product_id UUID, _quantity INTEGER, _owner_email TEXT, _unit_cost_cents INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bid UUID;
  new_code TEXT;
  attempt INTEGER := 0;
BEGIN
  IF NOT app_private.is_team(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF _quantity < 1 OR _quantity > 5000 THEN RAISE EXCEPTION 'Quantidade inválida (1-5000)'; END IF;

  LOOP
    new_code := 'L-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), 1, 16));
    BEGIN
      INSERT INTO public.batches (code, label, product_id, quantity, owner_email, unit_cost_cents, status)
      VALUES (
        new_code, _label, _product_id, _quantity,
        nullif(trim(_owner_email), ''), coalesce(_unit_cost_cents, 0), 'produzido'
      )
      RETURNING id INTO bid;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      attempt := attempt + 1;
      IF attempt > 5 THEN RAISE EXCEPTION 'Não foi possível gerar código único de lote.'; END IF;
    END;
  END LOOP;

  INSERT INTO public.plates (token, batch_id, product_id, status)
  SELECT replace(gen_random_uuid()::text, '-', ''), bid, _product_id, 'nao_ativada'
  FROM generate_series(1, _quantity);

  RETURN bid;
END;
$$;
REVOKE ALL ON FUNCTION public.create_batch(TEXT, UUID, INTEGER, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_batch(TEXT, UUID, INTEGER, TEXT, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.allocate_batch_from_stock(
  _label TEXT, _product_id UUID, _quantity INTEGER, _owner_email TEXT, _unit_cost_cents INTEGER DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bid UUID;
  new_code TEXT;
  attempt INTEGER := 0;
  available INTEGER;
BEGIN
  IF NOT app_private.is_team(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF _quantity < 1 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;

  SELECT count(*) INTO available FROM public.plates
   WHERE batch_id IS NULL AND product_id = _product_id;
  IF available < _quantity THEN
    RAISE EXCEPTION 'Estoque insuficiente: só há % un. disponíveis desse produto.', available;
  END IF;

  LOOP
    new_code := 'L-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), 1, 16));
    BEGIN
      INSERT INTO public.batches (code, label, product_id, quantity, owner_email, unit_cost_cents, status)
      VALUES (new_code, _label, _product_id, _quantity, nullif(trim(_owner_email), ''), coalesce(_unit_cost_cents, 0), 'vendido')
      RETURNING id INTO bid;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      attempt := attempt + 1;
      IF attempt > 5 THEN RAISE EXCEPTION 'Não foi possível gerar código único de lote.'; END IF;
    END;
  END LOOP;

  UPDATE public.plates SET batch_id = bid
   WHERE id IN (
     SELECT id FROM public.plates
      WHERE batch_id IS NULL AND product_id = _product_id
      ORDER BY short_code
      LIMIT _quantity
   );

  RETURN bid;
END;
$$;
REVOKE ALL ON FUNCTION public.allocate_batch_from_stock(TEXT, UUID, INTEGER, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.allocate_batch_from_stock(TEXT, UUID, INTEGER, TEXT, INTEGER) TO authenticated;
