-- Migration: Official pricing rules, product status and batch uniqueness
-- 1. Products: Only cartao-bolso active right now. Plaquinhas are 'em_breve'.
UPDATE public.products
SET status = 'ativo',
    has_nfc = true,
    has_qr = false
WHERE slug = 'cartao-bolso';

UPDATE public.products
SET status = 'em_breve'
WHERE slug IN ('plaquinha-10x10', 'plaquinha-10x15-l');

-- 2. Plan Lojista: 1-4 un: R$ 59,90 | 5 un: R$ 49,90 (Max 5 un)
UPDATE public.plans
SET unit_price_cents = 5990,
    min_quantity = 1,
    max_quantity = 5,
    description = 'Cartão de bolso configurado para seu negócio: R$ 59,90 a unidade até 4 unidades. Peça 5 e sai por R$ 49,90 cada.'
WHERE slug = 'lojista';

DELETE FROM public.plan_price_tiers
WHERE plan_id = (SELECT id FROM public.plans WHERE slug = 'lojista');

INSERT INTO public.plan_price_tiers (plan_id, min_quantity, unit_price_cents, label)
SELECT id, t.min_q, t.price, t.lbl
FROM public.plans,
     (VALUES
       (1, 5990, '1 a 4 unidades'),
       (5, 4990, '5 unidades')
     ) AS t(min_q, price, lbl)
WHERE slug = 'lojista';

DELETE FROM public.plan_packages
WHERE plan_id = (SELECT id FROM public.plans WHERE slug = 'lojista');

INSERT INTO public.plan_packages (plan_id, label, quantity, badge, note, sort_order)
SELECT p.id, t.lbl, t.qty, t.badge, t.note, t.ord
FROM public.plans p,
     (VALUES
       ('1 unidade', 1, NULL, 'R$ 59,90 cada', 1),
       ('3 unidades', 3, 'Mais escolhido', 'R$ 59,90 cada', 2),
       ('5 unidades', 5, 'Desconto especial', 'R$ 49,90 cada (máximo 5)', 3)
     ) AS t(lbl, qty, badge, note, ord)
WHERE p.slug = 'lojista';

-- 3. Plan Revenda: mínimo de 10; 10 a 24 por R$ 37,90 | 25 a 99 por R$ 27,90 | 100+ por R$ 19,90
UPDATE public.plans
SET unit_price_cents = 3790,
  min_quantity = 10,
    max_quantity = NULL,
  description = 'Pedido inicial a partir de 10 unidades: de 10 a 24 por R$ 37,90, de 25 a 99 por R$ 27,90 e 100 ou mais por R$ 19,90 cada.'
WHERE slug = 'renda-extra';

DELETE FROM public.plan_price_tiers
WHERE plan_id = (SELECT id FROM public.plans WHERE slug = 'renda-extra');

INSERT INTO public.plan_price_tiers (plan_id, min_quantity, unit_price_cents, label)
SELECT id, t.min_q, t.price, t.lbl
FROM public.plans,
     (VALUES
      (10, 3790, '10 a 24 unidades'),
      (25, 2790, '25 a 99 unidades'),
      (100, 1990, '100 unidades ou mais')
     ) AS t(min_q, price, lbl)
WHERE slug = 'renda-extra';

DELETE FROM public.plan_packages
WHERE plan_id = (SELECT id FROM public.plans WHERE slug = 'renda-extra');

INSERT INTO public.plan_packages (plan_id, label, quantity, badge, note, sort_order)
SELECT p.id, t.lbl, t.qty, t.badge, t.note, t.ord
FROM public.plans p,
     (VALUES
       ('10 unidades', 10, 'Início rápido', 'R$ 37,90 cada', 1),
       ('25 unidades', 25, 'Mais vendido', 'R$ 27,90 cada', 2),
       ('50 unidades', 50, 'Alta margem', 'R$ 27,90 cada', 3),
       ('100 unidades', 100, 'Máximo lucro', 'R$ 19,90 cada', 4)
     ) AS t(lbl, qty, badge, note, ord)
WHERE p.slug = 'renda-extra';

-- 4. Batch creation function with high entropy unique codes
CREATE OR REPLACE FUNCTION public.create_batch(
  _label TEXT, _product_id UUID, _quantity INTEGER, _owner_email TEXT, _unit_cost_cents INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS 
DECLARE
  bid UUID;
  new_code TEXT;
  attempt INTEGER := 0;
BEGIN
  IF NOT app_private.is_team(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF _quantity < 1 OR _quantity > 5000 THEN RAISE EXCEPTION 'Quantidade inválida (1-5000)'; END IF;

  LOOP
    new_code := 'L-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    BEGIN
      INSERT INTO public.batches (code, label, product_id, quantity, owner_email, unit_cost_cents, status)
      VALUES (
        new_code,
        _label,
        _product_id,
        _quantity,
        nullif(trim(_owner_email), ''),
        coalesce(_unit_cost_cents, 0),
        'produzido'
      )
      RETURNING id INTO bid;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      attempt := attempt + 1;
      IF attempt > 5 THEN
        RAISE EXCEPTION 'Não foi possível gerar código único de lote.';
      END IF;
    END;
  END LOOP;

  -- Plates generation
  INSERT INTO public.plates (token, batch_id, product_id, status)
  SELECT
    replace(gen_random_uuid()::text, '-', ''),
    bid,
    _product_id,
    'nao_ativada'
  FROM generate_series(1, _quantity);

  RETURN bid;
END;
;
