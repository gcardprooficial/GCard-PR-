-- Estoque solto (plaquinhas pre-impressas, sem lote/dono) + montagem de lote
-- do tamanho exato na hora da venda + resgate self-service por codigo.
-- Resolve: imprimir em runs grandes (custo por setup), vender em qualquer
-- quantidade sem sobrar/faltar lote fechado.

-- Gera N plaquinhas soltas (sem batch_id, sem dono) pra guardar em estoque.
CREATE OR REPLACE FUNCTION public.create_stock(_product_id UUID, _quantity INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT app_private.is_team(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF _quantity < 1 OR _quantity > 5000 THEN RAISE EXCEPTION 'Quantidade inválida (1-5000)'; END IF;
  INSERT INTO public.plates (token, batch_id, product_id, status)
  SELECT replace(gen_random_uuid()::text, '-', ''), NULL, _product_id, 'nao_ativada'
  FROM generate_series(1, _quantity);
  RETURN _quantity;
END;
$$;
REVOKE ALL ON FUNCTION public.create_stock(UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_stock(UUID, INTEGER) TO authenticated;

-- Monta um lote do tamanho exato do pedido puxando plaquinhas do estoque solto.
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
    new_code := 'L-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
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

-- Cliente resgata um lote pelo codigo (ex: L-260915-AB12CD) e vincula na conta dele.
-- So funciona se o lote ainda nao tiver dono vinculado (owner_user_id NULL).
CREATE OR REPLACE FUNCTION public.claim_batch_by_code(_code TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  my_email TEXT;
  n INTEGER;
BEGIN
  SELECT email INTO my_email FROM auth.users WHERE id = auth.uid();
  IF my_email IS NULL THEN RAISE EXCEPTION 'Sessão inválida.'; END IF;

  UPDATE public.batches
     SET owner_user_id = auth.uid(), owner_email = my_email, updated_at = now()
   WHERE code = trim(_code)
     AND owner_user_id IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;

  IF n = 0 THEN
    IF EXISTS (SELECT 1 FROM public.batches WHERE code = trim(_code)) THEN
      RAISE EXCEPTION 'Esse lote já foi resgatado por outra conta.';
    END IF;
    RAISE EXCEPTION 'Código de lote não encontrado.';
  END IF;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_batch_by_code(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_batch_by_code(TEXT) TO authenticated;
