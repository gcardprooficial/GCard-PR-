-- guard_reseller_plate_update() só liberava pra service_role/time logado. No
-- SQL Editor (postgres, sem JWT) auth.uid() é NULL e a trigger bloqueava até
-- ação administrativa direta -- inclusive um UPDATE...SET NULL disparado por
-- ON DELETE de batches. NULL = sem contexto de usuário comum = confia.
CREATE OR REPLACE FUNCTION public.guard_reseller_plate_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR auth.role() = 'supabase_admin' OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF app_private.is_team(auth.uid()) THEN RETURN NEW; END IF;
  IF NEW.token <> OLD.token
     OR NEW.order_id IS DISTINCT FROM OLD.order_id
     OR NEW.batch_id IS DISTINCT FROM OLD.batch_id
     OR NEW.product_id IS DISTINCT FROM OLD.product_id
     OR NEW.business_id IS DISTINCT FROM OLD.business_id
     OR NEW.scan_count <> OLD.scan_count THEN
    RAISE EXCEPTION 'Alteração não permitida';
  END IF;
  IF NEW.status NOT IN ('ativada', 'nao_ativada') THEN
    RAISE EXCEPTION 'Status inválido';
  END IF;
  IF NEW.destination_url IS NOT NULL
     AND NEW.destination_url !~ '^https://(search\.google\.com|www\.google\.com|google\.com|maps\.google\.com|g\.page)/' THEN
    RAISE EXCEPTION 'Link precisa ser do Google';
  END IF;
  RETURN NEW;
END;
$$;
