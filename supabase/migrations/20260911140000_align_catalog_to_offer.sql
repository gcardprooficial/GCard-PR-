UPDATE public.products
SET status = 'em_breve'
WHERE slug IN ('plaquinha-10x10', 'plaquinha-10x15-l');

UPDATE public.plans
SET max_quantity = 5
WHERE slug = 'lojista';

UPDATE public.plans
SET unit_price_cents = 3790,
    description = 'Lote de cartões em branco para revenda: 1 a 10 por R$ 37,90, de 11 a 50 por R$ 27,90 e acima de 50 por R$ 19,90 cada.'
WHERE slug = 'renda-extra';

DELETE FROM public.plan_price_tiers
WHERE plan_id = (SELECT id FROM public.plans WHERE slug = 'renda-extra');

INSERT INTO public.plan_price_tiers (plan_id, min_quantity, unit_price_cents, label)
SELECT id, t.min_quantity, t.price, t.label
FROM public.plans,
     (VALUES
       (1, 3790, '1 a 10 unidades'),
       (11, 2790, '11 a 50 unidades'),
       (51, 1990, '51 unidades ou mais')
     ) AS t(min_quantity, price, label)
WHERE slug = 'renda-extra';