-- BUG: allocate_batch_from_stock fazia SELECT count(*) e depois UPDATE em
-- statements separados (check-then-act), sem lock. Dois lotes montados ao
-- mesmo tempo do mesmo produto podiam: (a) ambos passar no check de
-- disponibilidade, e (b) o UPDATE final mira em ids concretos escolhidos
-- ANTES do lock -- se o primeiro ja tinha reatribuido aquele id pra outro
-- lote, o segundo UPDATE simplesmente sobrescrevia o batch_id de novo,
-- roubando silenciosamente a plaquinha de um lote pro outro (a placa
-- fisica so pode ir pra uma caixa, mas o banco prometia ela pra dois).
--
-- Corrige com FOR UPDATE SKIP LOCKED: cada chamada concorrente trava as
-- proprias linhas candidatas e pula as ja travadas por outra transacao
-- em andamento, nunca mira duas vezes na mesma placa. Se nao sobrar
-- estoque suficiente (concorrencia levou o resto), a funcao inteira
-- desfaz (insert do lote incluido) e avisa quantas unidades reais deram.
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
  claimed INTEGER;
BEGIN
  IF NOT app_private.is_team(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF _quantity < 1 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;

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

  WITH claim AS (
    SELECT id FROM public.plates
     WHERE batch_id IS NULL AND product_id = _product_id
     ORDER BY short_code
     LIMIT _quantity
     FOR UPDATE SKIP LOCKED
  )
  UPDATE public.plates SET batch_id = bid
   WHERE id IN (SELECT id FROM claim);
  GET DIAGNOSTICS claimed = ROW_COUNT;

  IF claimed < _quantity THEN
    RAISE EXCEPTION 'Estoque insuficiente: só consegui reservar % de % un. desse produto (outra venda pode ter levado o resto agora mesmo).', claimed, _quantity;
  END IF;

  RETURN bid;
END;
$$;
REVOKE ALL ON FUNCTION public.allocate_batch_from_stock(TEXT, UUID, INTEGER, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.allocate_batch_from_stock(TEXT, UUID, INTEGER, TEXT, INTEGER) TO authenticated;
