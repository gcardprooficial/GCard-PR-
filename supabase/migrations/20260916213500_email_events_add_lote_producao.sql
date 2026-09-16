-- email_events_event_type_check ficou desatualizada: o código já disparava
-- "lote_criado" e "em_producao" há tempo, mas a constraint só aceitava os 3
-- eventos originais. Toda tentativa desses dois falhava com 23514, silenciosa
-- no painel até agora.

ALTER TABLE public.email_events DROP CONSTRAINT email_events_event_type_check;

ALTER TABLE public.email_events ADD CONSTRAINT email_events_event_type_check
  CHECK (event_type IN (
    'pedido_recebido',
    'pagamento_confirmado',
    'lote_criado',
    'em_producao',
    'pedido_enviado'
  ));
