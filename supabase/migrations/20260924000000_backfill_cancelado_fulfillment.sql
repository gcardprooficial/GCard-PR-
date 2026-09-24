-- Pedidos cancelado/estornado que ficaram com resíduo de produção (em_producao/enviado/
-- entregue) confundiam a aba "Em produção"/"Enviados" no painel. Daqui pra frente o painel
-- já sincroniza os dois campos junto; isso aqui só limpa o que já existia.
UPDATE public.orders
SET fulfillment_status = 'cancelado'
WHERE payment_status IN ('cancelado', 'estornado')
  AND fulfillment_status <> 'cancelado';
