-- Cartão PVC (só NFC, material mais simples) tinha ficado mais caro em
-- revenda que a plaquinha de acrílico (QR+NFC, mais material e trabalho).
-- Invertido: cartão custa real ~R$3,57/un, tem que ficar abaixo da placa
-- em toda faixa. Preço com folga de margem (>50% mesmo no pior cenário
-- de frete/perdas/taxa de gateway).
UPDATE public.plans
SET unit_price_cents = 1490,
    description = 'Pedido inicial a partir de 10 unidades: de 10 a 24 por R$ 14,90, de 25 a 99 por R$ 11,90 e 100 ou mais por R$ 9,90 cada. Frete grátis já incluso.'
WHERE slug = 'renda-extra';

DELETE FROM public.plan_price_tiers
WHERE plan_id = (SELECT id FROM public.plans WHERE slug = 'renda-extra');

INSERT INTO public.plan_price_tiers (plan_id, min_quantity, unit_price_cents, label)
SELECT id, t.min_q, t.price, t.lbl
FROM public.plans,
     (VALUES (10, 1490, '10 a 24 unidades'), (25, 1190, '25 a 99 unidades'), (100, 990, '100 unidades ou mais'))
       AS t(min_q, price, lbl)
WHERE slug = 'renda-extra';

DELETE FROM public.plan_packages
WHERE plan_id = (SELECT id FROM public.plans WHERE slug = 'renda-extra');

INSERT INTO public.plan_packages (plan_id, label, quantity, badge, note, sort_order)
SELECT p.id, t.lbl, t.qty, t.badge, t.note, t.ord
FROM public.plans p,
     (VALUES
       ('10 unidades', 10, NULL, 'R$ 14,90 cada', 1),
       ('25 unidades', 25, 'Melhor custo', 'R$ 11,90 cada', 2),
       ('100 unidades', 100, 'Maior margem', 'R$ 9,90 cada', 3)
     ) AS t(lbl, qty, badge, note, ord)
WHERE p.slug = 'renda-extra';

-- Nomes com a marca, padrão pedido.
UPDATE public.products SET name = 'Cartão GCard-Pro - Avaliação do Google' WHERE slug = 'cartao-bolso';
UPDATE public.products SET name = 'Plaquinha GCard-Pro quadrada - Avaliação do Google' WHERE slug = 'plaquinha-10x10';
UPDATE public.products SET name = 'Plaquinha GCard-Pro em L - Avaliação do Google' WHERE slug = 'plaquinha-10x15-l';
