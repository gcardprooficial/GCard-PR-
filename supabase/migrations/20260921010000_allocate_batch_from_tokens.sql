-- Monta o lote de um pedido a partir das placas que a equipe ESCANEOU (tokens dos QR),
-- em vez de pegar N placas em ordem do estoque. As placas saem impressas fora de ordem,
-- então a única fonte de verdade é o QR físico que vai na caixa.
--
-- Regras: todo token precisa existir e estar livre (sem lote e sem pedido) e ser do
-- produto do pedido. Tudo ou nada: se qualquer token falhar, nada é vinculado.
CREATE OR REPLACE FUNCTION public.allocate_batch_from_tokens(
  _label TEXT,
  _product_id UUID,
  _tokens TEXT[],
  _owner_email TEXT,
  _owner_order_id UUID DEFAULT NULL
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
  wanted TEXT[];
  found_count INTEGER;
  bad TEXT;
BEGIN
  IF NOT app_private.is_team(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão'; END IF;

  SELECT coalesce(array_agg(DISTINCT lower(trim(t))), ARRAY[]::TEXT[])
    INTO wanted
    FROM unnest(_tokens) AS t
   WHERE trim(t) <> '';
  IF coalesce(array_length(wanted, 1), 0) < 1 THEN RAISE EXCEPTION 'Nenhum token informado.'; END IF;

  -- Tokens que não existem
  SELECT string_agg(w, ', ') INTO bad
    FROM unnest(wanted) AS w
   WHERE NOT EXISTS (SELECT 1 FROM public.plates p WHERE p.token = w);
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'Token(s) não encontrado(s): %', bad; END IF;

  -- Tokens que já estão em outro lote/pedido
  SELECT string_agg(p.short_code || ' (já está em lote ou pedido)', ', ') INTO bad
    FROM public.plates p
   WHERE p.token = ANY(wanted) AND (p.batch_id IS NOT NULL OR p.order_id IS NOT NULL);
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'Placa(s) indisponível(is): %', bad; END IF;

  -- Tokens de outro produto
  SELECT string_agg(p.short_code || ' (outro produto)', ', ') INTO bad
    FROM public.plates p
   WHERE p.token = ANY(wanted) AND p.product_id IS DISTINCT FROM _product_id;
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'Placa(s) de produto diferente do pedido: %', bad; END IF;

  LOOP
    new_code := 'L-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), 1, 16));
    BEGIN
      INSERT INTO public.batches (code, label, product_id, quantity, owner_email, unit_cost_cents, status, owner_order_id)
      VALUES (new_code, _label, _product_id, array_length(wanted, 1), nullif(trim(_owner_email), ''), 0, 'vendido', _owner_order_id)
      RETURNING id INTO bid;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      attempt := attempt + 1;
      IF attempt > 5 THEN RAISE EXCEPTION 'Não foi possível gerar código único de lote.'; END IF;
    END;
  END LOOP;

  -- Trava as linhas e vincula; se outra transação levou alguma no meio, desfaz tudo.
  WITH claim AS (
    SELECT id FROM public.plates
     WHERE token = ANY(wanted) AND batch_id IS NULL AND order_id IS NULL
     FOR UPDATE SKIP LOCKED
  )
  UPDATE public.plates SET batch_id = bid WHERE id IN (SELECT id FROM claim);
  GET DIAGNOSTICS found_count = ROW_COUNT;

  IF found_count <> array_length(wanted, 1) THEN
    RAISE EXCEPTION 'Só consegui vincular % de % placas (outra operação usou alguma agora mesmo).', found_count, array_length(wanted, 1);
  END IF;

  RETURN bid;
END;
$$;
REVOKE ALL ON FUNCTION public.allocate_batch_from_tokens(TEXT, UUID, TEXT[], TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.allocate_batch_from_tokens(TEXT, UUID, TEXT[], TEXT, UUID) TO authenticated;
