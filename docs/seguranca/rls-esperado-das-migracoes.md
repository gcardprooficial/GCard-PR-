# RLS esperado, segundo as migrações

Gerado lendo `supabase/migrations/*.sql` (o último CREATE/DROP de cada policy vale). Compare com o resultado de
`rls-banco-vivo.sql` rodado no SQL Editor do Supabase. Diferença = banco vivo divergente das migrações.

| Tabela | RLS | Policy | Comando | Papéis |
|---|---|---|---|---|
| abuse_reports | sim | abuse team read | SELECT | authenticated |
| abuse_reports | sim | abuse team update | UPDATE | authenticated |
| affiliate_commissions | sim | affiliate commissions team select | SELECT | authenticated |
| affiliates | sim | affiliates team insert | INSERT | authenticated |
| affiliates | sim | affiliates team select | SELECT | authenticated |
| affiliates | sim | affiliates team update | UPDATE | authenticated |
| allowed_destination_hosts | sim | dest hosts read | SELECT | authenticated |
| allowed_destination_hosts | sim | dest hosts team write | ALL | authenticated |
| app_settings | sim | settings team all | ALL | authenticated |
| audit_log | sim | audit team insert | INSERT | authenticated |
| audit_log | sim | audit team read | SELECT | authenticated |
| batches | sim | batches owner read | SELECT | authenticated |
| batches | sim | batches team all | ALL | authenticated |
| businesses | sim | businesses team read | SELECT | authenticated |
| businesses | sim | businesses team write | ALL | authenticated |
| card_stock_entries | sim | card stock team all | ALL | authenticated |
| chat_conversations | sim | (nenhuma: só service_role acessa) | - | - |
| chat_messages | sim | (nenhuma: só service_role acessa) | - | - |
| checkout_sessions | sim | sessions team read | SELECT | authenticated |
| component_stock_entries | sim | component stock team all | ALL | authenticated |
| consent_records | sim | consent records team read | SELECT | authenticated |
| consent_texts | sim | consent texts public | SELECT | anon, authenticated |
| email_events | sim | (nenhuma: só service_role acessa) | - | - |
| events | sim | events team read | SELECT | authenticated |
| finance_entries | sim | finance team all | ALL | authenticated |
| finance_partners | sim | partners team all | ALL | authenticated |
| marketing_contacts | sim | (nenhuma: só service_role acessa) | - | - |
| order_items | sim | order items team read | SELECT | authenticated |
| orders | sim | orders team read | SELECT | authenticated |
| orders | sim | orders team update | UPDATE | authenticated |
| plan_packages | sim | packages admin write | ALL | authenticated |
| plan_packages | sim | packages public read | SELECT | anon, authenticated |
| plan_price_tiers | sim | plan_price_tiers_public_read | SELECT | anon, authenticated |
| plans | sim | plans admin write | ALL | authenticated |
| plans | sim | plans public read | SELECT | anon, authenticated |
| plate_scan_events | sim | scans owner read | SELECT | authenticated |
| plate_scan_events | sim | scans team read | SELECT | authenticated |
| plates | sim | plates owner read | SELECT | authenticated |
| plates | sim | plates owner update | UPDATE | authenticated |
| plates | sim | plates team delete stock | DELETE | authenticated |
| plates | sim | plates team read | SELECT | authenticated |
| plates | sim | plates team update | UPDATE | authenticated |
| product_price_tiers | sim | product_price_tiers_public_read | SELECT | anon, authenticated |
| products | sim | catalog admin write | ALL | authenticated |
| products | sim | catalog public read | SELECT | anon, authenticated |
| profiles | sim | own profile insert | INSERT | authenticated |
| profiles | sim | own profile read | SELECT | authenticated |
| profiles | sim | own profile update | UPDATE | authenticated |
| storage | NAO | wa audio team | ALL | authenticated |
| tool_leads | sim | tool leads team select | SELECT | authenticated |
| tool_leads | sim | tool leads team update | UPDATE | authenticated |
| user_roles | sim | roles read own or team | SELECT | authenticated |
| wa_contacts | sim | wa contacts team | ALL | authenticated |
| wa_conversations | sim | wa conv team | ALL | authenticated |
| wa_flows | sim | wa flows team | ALL | authenticated |
| wa_knowledge | sim | wa know team | ALL | authenticated |
| wa_messages | sim | wa msg team read | SELECT | authenticated |
| wa_order_notifications | sim | wa notif team read | SELECT | authenticated |
| wa_quick_replies | sim | wa quick team | ALL | authenticated |
