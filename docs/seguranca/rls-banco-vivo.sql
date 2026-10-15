-- SOMENTE LEITURA. Rode no SQL Editor do Supabase do GCard e compare com rls-esperado-das-migracoes.md.
-- Nada aqui altera dados nem permissões.

-- 1) Tabelas do schema public: RLS ligada?
select c.relname as tabela, c.relrowsecurity as rls_ligada, c.relforcerowsecurity as rls_forcada
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by 1;

-- 2) Policies de cada tabela
select tablename as tabela, policyname as policy, cmd as comando, roles as papeis,
       qual as using_expr, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 3) O que anon e authenticated podem fazer em cada tabela (GRANT)
select table_name as tabela, grantee, string_agg(privilege_type, ', ' order by privilege_type) as privilegios
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated')
group by 1, 2
order by 1, 2;

-- 4) Funções SECURITY DEFINER e quem pode executá-las (RPC exposta)
select n.nspname as schema, p.proname as funcao, pg_get_function_identity_arguments(p.oid) as argumentos,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_executa,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_executa
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'app_private') and p.prosecdef
order by 1, 2;

-- 5) Triggers em tabelas sensíveis (plates, orders, auth.users)
select event_object_schema as schema, event_object_table as tabela, trigger_name as trigger,
       event_manipulation as evento, action_timing as quando
from information_schema.triggers
where (event_object_schema = 'public' and event_object_table in ('plates', 'orders', 'plate_scan_events'))
   or (event_object_schema = 'auth' and event_object_table = 'users')
order by 2, 3;

-- 6) Views do schema public (precisam de security_invoker para respeitar a RLS de quem consulta)
select c.relname as view, coalesce(c.reloptions::text, '(sem opções)') as opcoes
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'v'
order by 1;
