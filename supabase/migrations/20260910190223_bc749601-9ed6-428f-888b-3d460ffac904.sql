CREATE TABLE public.plan_price_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  min_quantity integer NOT NULL CHECK (min_quantity >= 1),
  unit_price_cents integer NOT NULL CHECK (unit_price_cents > 0),
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, min_quantity)
);

GRANT SELECT ON public.plan_price_tiers TO anon;
GRANT SELECT ON public.plan_price_tiers TO authenticated;
GRANT ALL ON public.plan_price_tiers TO service_role;

ALTER TABLE public.plan_price_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plan_price_tiers_public_read" ON public.plan_price_tiers
  FOR SELECT TO anon, authenticated USING (true);

UPDATE public.plans SET is_active = false WHERE slug = 'clube-revenda-vip';

UPDATE public.plans
   SET unit_price_cents = 3490,
       min_quantity = 1,
       max_quantity = NULL,
       name = 'Pack Renda Extra',
       audience = 'Comprar em quantidade e revender',
       description = 'Quanto mais unidades, menor o preço: 1 a 9 por R$ 34,90, de 10 a 49 por R$ 24,90 e de 50 em diante por R$ 19,90 cada.'
 WHERE slug = 'pack-renda-extra';

UPDATE public.plans
   SET min_quantity = 1,
       max_quantity = NULL,
       audience = 'Para usar no meu próprio balcão'
 WHERE slug = 'plano-lojista';

INSERT INTO public.plan_price_tiers (plan_id, min_quantity, unit_price_cents, label)
SELECT id, 1, 5990, '1 unidade ou mais' FROM public.plans WHERE slug = 'plano-lojista';

INSERT INTO public.plan_price_tiers (plan_id, min_quantity, unit_price_cents, label)
SELECT id, t.min_q, t.price, t.lbl
  FROM public.plans p,
       (VALUES (1, 3490, '1 a 9 unidades'), (10, 2490, '10 a 49 unidades'), (50, 1990, '50 unidades ou mais'))
         AS t(min_q, price, lbl)
 WHERE p.slug = 'pack-renda-extra';

DELETE FROM public.plan_packages
 WHERE plan_id IN (SELECT id FROM public.plans WHERE slug IN ('plano-lojista', 'pack-renda-extra'));

INSERT INTO public.plan_packages (plan_id, label, quantity, badge, note, sort_order)
SELECT p.id, t.lbl, t.qty, t.badge, t.note, t.ord
  FROM public.plans p,
       (VALUES
         ('1 unidade', 1, NULL, 'Para testar', 1),
         ('3 unidades', 3, 'Mais escolhido', 'Um por ponto de atendimento', 2),
         ('5 unidades', 5, NULL, 'Balcão, mesas e vitrine', 3),
         ('10 unidades', 10, NULL, 'Equipe inteira coberta', 4)
       ) AS t(lbl, qty, badge, note, ord)
 WHERE p.slug = 'plano-lojista';

INSERT INTO public.plan_packages (plan_id, label, quantity, badge, note, sort_order)
SELECT p.id, t.lbl, t.qty, t.badge, t.note, t.ord
  FROM public.plans p,
       (VALUES
         ('5 unidades', 5, NULL, 'R$ 34,90 cada', 1),
         ('10 unidades', 10, 'Melhor custo', 'Cai para R$ 24,90 cada', 2),
         ('25 unidades', 25, NULL, 'R$ 24,90 cada', 3),
         ('50 unidades', 50, 'Maior margem', 'Cai para R$ 19,90 cada', 4)
       ) AS t(lbl, qty, badge, note, ord)
 WHERE p.slug = 'pack-renda-extra';