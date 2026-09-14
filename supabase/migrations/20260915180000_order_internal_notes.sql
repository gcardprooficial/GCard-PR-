-- Nota interna do pedido (staff-only, nunca exposta pro cliente) --
-- contexto operacional tipo "cliente ligou reclamando de atraso".
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS internal_notes TEXT;
