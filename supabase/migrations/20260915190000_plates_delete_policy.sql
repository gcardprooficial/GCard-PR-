-- BUG: nao existia policy de DELETE em plates -- so SELECT e UPDATE. RLS
-- bloqueia por padrao qualquer operacao sem policy correspondente, sem
-- erro visivel: o DELETE do client "funcionava" (sem exception) mas
-- afetava 0 linhas, dando a impressao de "nao excluiu, os dados voltam".
--
-- Libera DELETE pro time, restrito a plaquinha solta (batch_id IS NULL)
-- -- nunca deixa apagar direto uma plaquinha que ja pertence a um lote
-- (pra isso existe excluir o lote inteiro, que devolve as placas ao
-- estoque via ON DELETE SET NULL do FK).
CREATE POLICY "plates team delete stock" ON public.plates FOR DELETE TO authenticated
  USING (app_private.is_team(auth.uid()) AND batch_id IS NULL);
