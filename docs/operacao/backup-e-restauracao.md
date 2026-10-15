# Backup e restauração — GCard-PRÓ

O que existe, onde fica e como voltar atrás. Revisar a cada 3 meses (marcar a data no fim).

## O que precisa de backup

| Item | Onde está | Perda = |
|---|---|---|
| Banco (pedidos, placas, contas, financeiro) | Supabase | crítico: sem isso não há negócio |
| Arquivos enviados (artes, anexos) | Supabase Storage | alto |
| Código | GitHub (`GCard-PRO`) | baixo (já versionado) |
| Variáveis de ambiente (chaves Pagar.me, Resend, SuperFrete…) | Vercel → Settings → Environment Variables | alto: guardar cópia num gerenciador de senhas |
| Domínio | registro do domínio | crítico se vencer: ver lembrete no painel (Relatórios) |

## Banco: o que o Supabase já faz
- Backup diário automático (planos pagos). Conferir em Supabase → Database → Backups que o último tem menos de 24 h.
- Plano gratuito NÃO guarda backup: nesse caso, fazer o dump manual abaixo toda semana.

## Dump manual (semanal, ou antes de qualquer mudança grande)
No terminal, com a string de conexão do Supabase (Settings → Database → Connection string, modo "Session"), que **não** vai para o chat nem para o Git:

```bash
pg_dump "$DATABASE_URL" --no-owner --no-privileges -Fc -f gcard-$(date +%F).dump
```

Guardar o arquivo fora do computador (Drive/HD externo). O dump contém dados pessoais de clientes (LGPD): pasta protegida, nunca em repositório.

## Restaurar
1. **Nunca restaurar em cima da produção direto.** Criar um projeto Supabase novo (ou usar o de teste).
2. `pg_restore --no-owner --no-privileges -d "$DATABASE_URL_NOVO" gcard-AAAA-MM-DD.dump`
3. Conferir: `select count(*) from orders; select count(*) from plates;` batendo com o esperado.
4. Rodar `docs/seguranca/teste-rls-admin.sql` no projeto restaurado (tudo `ok = true`).
5. Só então apontar a Vercel (variáveis `SUPABASE_URL`, chaves) para o projeto restaurado, e fazer redeploy.
6. Testar: login, abrir um pedido, `/r/<token>` de uma placa real, um Pix de teste.

## Restaurar um dado só (ex.: apaguei uma linha sem querer)
Restaurar o dump num projeto de teste, copiar a(s) linha(s) com `select` + `insert` na produção. Mostrar o `select` antes de qualquer `insert/delete`.

## Placas (QR) — o mais sensível
As placas impressas apontam para `/r/<token>`. Os tokens só existem na tabela `plates`. **Perder essa tabela = placas físicas quebradas.** Por isso o dump semanal é obrigatório enquanto houver placas vendidas.

## Se o domínio vencer ou o site cair
- Os QR continuam apontando para `gcardpro.com.br`: domínio vencido = todas as placas morrem.
- Renovar o domínio é prioridade zero. A data fica em Relatórios → "Vence em" e aparece no topo do painel faltando 60 dias.

## Último teste de restauração
_Ainda não feito. Fazer um teste completo (passos 1–6) e anotar a data aqui._
