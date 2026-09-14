-- O mesmo adicional (price_delta_cents) era usado tanto pra loja própria quanto
-- pra revenda, deixando a plaquinha 10x10 em revenda cara demais frente ao
-- mercado (R$52,90/un vs ~R$20-22 de concorrente). Separa os dois.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS resale_delta_cents INTEGER NOT NULL DEFAULT 0;

-- Cartão: sem adicional em nenhum dos dois (já era 0).
-- Plaquinha 10x10: loja própria continua R$79,90 (delta 2000, como você pediu).
-- Revenda: adicional bem menor, cobre a diferença real de custo (~R$5 a mais
-- que o cartão) sem inflar o preço final.
UPDATE public.products SET resale_delta_cents = 500 WHERE slug = 'plaquinha-10x10';
