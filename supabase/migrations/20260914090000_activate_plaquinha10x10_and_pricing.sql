-- Arte da plaquinha 10x10 pronta: ativa no catálogo, R$ 79,90 configurada
-- (delta de R$20 sobre o preço base do cartão, igual pra lojista e revenda).
UPDATE public.products
SET status = 'ativo', price_delta_cents = 2000, has_qr = true, has_nfc = true
WHERE slug = 'plaquinha-10x10';

-- 10x15 em L segue "em breve" (sem arte ainda) — nada a fazer, já está assim.

-- Cartão revenda mais competitivo, ainda lucrativo com frete grátis embutido.
-- Custo real (materiais+adesivo+embalagem+mão de obra+perdas): ~R$3,57/un.
-- + frete de envio ao revendedor embutido no preço (rateado por lote).
UPDATE public.plans
SET unit_price_cents = 3290,
    description = 'Pedido inicial a partir de 10 unidades: de 10 a 24 por R$ 32,90, de 25 a 99 por R$ 24,90 e 100 ou mais por R$ 14,90 cada. Frete grátis já incluso.'
WHERE slug = 'renda-extra';

DELETE FROM public.plan_price_tiers
WHERE plan_id = (SELECT id FROM public.plans WHERE slug = 'renda-extra');

INSERT INTO public.plan_price_tiers (plan_id, min_quantity, unit_price_cents, label)
SELECT id, t.min_q, t.price, t.lbl
FROM public.plans,
     (VALUES
       (10, 3290, '10 a 24 unidades'),
       (25, 2490, '25 a 99 unidades'),
       (100, 1490, '100 unidades ou mais')
     ) AS t(min_q, price, lbl)
WHERE slug = 'renda-extra';

DELETE FROM public.plan_packages
WHERE plan_id = (SELECT id FROM public.plans WHERE slug = 'renda-extra');

INSERT INTO public.plan_packages (plan_id, label, quantity, badge, note, sort_order)
SELECT p.id, t.lbl, t.qty, t.badge, t.note, t.ord
FROM public.plans p,
     (VALUES
       ('10 unidades', 10, NULL, 'R$ 32,90 cada', 1),
       ('25 unidades', 25, 'Melhor custo', 'R$ 24,90 cada', 2),
       ('100 unidades', 100, 'Maior margem', 'R$ 14,90 cada', 3)
     ) AS t(lbl, qty, badge, note, ord)
WHERE p.slug = 'renda-extra';

-- Premissas de custo reais, por produto, pro painel (Financeiro > Calculadora).
INSERT INTO public.app_settings (key, value) VALUES (
  'pricing_products',
  '{
    "cartao-bolso": {"label":"Cartão PVC NFC de bolso","unit_cost_cents":187,"sticker_cents":57,"packaging_cents":30,"shipping_in_cents":23,"labor_cents":50,"loss_pct":3,"gateway_pct":4.99,"min_margin_pct":30,"note":"PVC+chip WJ 1,87 + adesivo frente 8,5x5,5 (lote 50) 0,57"},
    "plaquinha-10x10": {"label":"Plaquinha acrílico 10x10","unit_cost_cents":420,"sticker_cents":220,"packaging_cents":30,"shipping_in_cents":23,"labor_cents":50,"loss_pct":3,"gateway_pct":4.99,"min_margin_pct":30,"note":"Acrílico Richard 4,20 + adesivo retro-verso 10x10 (lote 50) 2,20"}
  }'::jsonb
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
