-- Migration 4 (20260910190223) targeted plan slugs that were never seeded
-- (plano-lojista / pack-renda-extra / clube-revenda-vip) while migration 1 seeded
-- lojista / renda-extra / revenda-vip. Net effect on a clean DB: zero price tiers,
-- stale plan rows. This redoes migration 4's intent against the real slugs.

UPDATE public.plans SET is_active = false WHERE slug = 'revenda-vip';

UPDATE public.plans
   SET unit_price_cents = 3490,
       min_quantity = 1,
       max_quantity = NULL,
       name = 'Pack Renda Extra',
       audience = 'Comprar em quantidade e revender',
       description = 'Quanto mais unidades, menor o preço: 1 a 9 por R$ 34,90, de 10 a 49 por R$ 24,90 e de 50 em diante por R$ 19,90 cada.'
 WHERE slug = 'renda-extra';

UPDATE public.plans
   SET min_quantity = 1,
       max_quantity = NULL,
       audience = 'Para usar no meu próprio balcão'
 WHERE slug = 'lojista';

DELETE FROM public.plan_price_tiers
 WHERE plan_id IN (SELECT id FROM public.plans WHERE slug IN ('lojista', 'renda-extra'));

INSERT INTO public.plan_price_tiers (plan_id, min_quantity, unit_price_cents, label)
SELECT id, 1, 5990, '1 unidade ou mais' FROM public.plans WHERE slug = 'lojista';

INSERT INTO public.plan_price_tiers (plan_id, min_quantity, unit_price_cents, label)
SELECT p.id, t.min_q, t.price, t.lbl
  FROM public.plans p,
       (VALUES (1, 3490, '1 a 9 unidades'), (10, 2490, '10 a 49 unidades'), (50, 1990, '50 unidades ou mais'))
         AS t(min_q, price, lbl)
 WHERE p.slug = 'renda-extra';

DELETE FROM public.plan_packages
 WHERE plan_id IN (SELECT id FROM public.plans WHERE slug IN ('lojista', 'renda-extra'));

INSERT INTO public.plan_packages (plan_id, label, quantity, badge, note, sort_order)
SELECT p.id, t.lbl, t.qty, t.badge, t.note, t.ord
  FROM public.plans p,
       (VALUES
         ('1 unidade', 1, NULL, 'Para testar', 1),
         ('3 unidades', 3, 'Mais escolhido', 'Um por ponto de atendimento', 2),
         ('5 unidades', 5, NULL, 'Balcão, mesas e vitrine', 3),
         ('10 unidades', 10, NULL, 'Equipe inteira coberta', 4)
       ) AS t(lbl, qty, badge, note, ord)
 WHERE p.slug = 'lojista';

INSERT INTO public.plan_packages (plan_id, label, quantity, badge, note, sort_order)
SELECT p.id, t.lbl, t.qty, t.badge, t.note, t.ord
  FROM public.plans p,
       (VALUES
         ('5 unidades', 5, NULL, 'R$ 34,90 cada', 1),
         ('10 unidades', 10, 'Melhor custo', 'Cai para R$ 24,90 cada', 2),
         ('25 unidades', 25, NULL, 'R$ 24,90 cada', 3),
         ('50 unidades', 50, 'Maior margem', 'Cai para R$ 19,90 cada', 4)
       ) AS t(lbl, qty, badge, note, ord)
 WHERE p.slug = 'renda-extra';
