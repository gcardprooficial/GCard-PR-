-- Plaquinha em L disponível no catálogo (arte final pode ser trocada depois)
UPDATE public.products
   SET status = 'ativo',
       tagline = 'Fica em pé na mesa, pronta para o cliente',
       description = 'Formato em L para mesa e balcão, com NFC + QR dinâmico. Ideal para restaurantes, bares e cafeterias.'
 WHERE slug = 'plaquinha-10x15-l';

UPDATE public.products
   SET tagline = 'Só aproximar — NFC, sem QR',
       description = 'Cartão de bolso premium: o cliente aproxima o celular e cai na avaliação do Google. Ideal para bolso, maquininha e recepção.'
 WHERE slug = 'cartao-bolso';
