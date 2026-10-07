-- Novo estado interno "pronto" (já produzido, ainda não enviado). Só controle da equipe:
-- nenhum e-mail/WhatsApp é disparado por ele.
ALTER TYPE public.fulfillment_status ADD VALUE IF NOT EXISTS 'pronto' BEFORE 'enviado';
