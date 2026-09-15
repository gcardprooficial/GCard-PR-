-- BUG: plan_packages.note tinha preco fixo escrito ("R$ 14,90 cada") pro
-- plano renda-extra, mas esse plano e compartilhado entre cartao-bolso E
-- plaquinha-10x10 -- a plaquinha tem preco proprio (product_price_tiers,
-- 21,90/18,90/15,90) que sobrepoe o plano via resolveUnitPrice(). O note
-- estatico mostrava o preco do CARTAO mesmo na tela da PLAQUINHA,
-- enquanto o "Total"/"por unidade" (calculado dinamico) mostrava o preco
-- certo -- os dois nunca podiam bater ao mesmo tempo pros dois produtos.
--
-- Corrige tirando o preco do note (ja e mostrado dinamico e correto
-- logo abaixo, por produto) e deixando so texto descritivo generico.
UPDATE public.plan_packages
   SET note = CASE quantity
     WHEN 10 THEN 'Pedido inicial'
     WHEN 25 THEN 'Melhor custo-benefício'
     WHEN 100 THEN 'Maior margem de revenda'
     ELSE note
   END
 WHERE plan_id = (SELECT id FROM public.plans WHERE slug = 'renda-extra');
