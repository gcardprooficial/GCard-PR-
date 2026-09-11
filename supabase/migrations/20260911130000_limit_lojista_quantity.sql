-- Lojista purchases are limited to five ready-to-use cards.
UPDATE public.plans
SET max_quantity = 5
WHERE slug = 'lojista';

DELETE FROM public.plan_packages
WHERE plan_id = (SELECT id FROM public.plans WHERE slug = 'lojista')
  AND quantity > 5;