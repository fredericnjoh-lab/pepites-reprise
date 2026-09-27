-- PÉPITES — 3/3 : secret d'ingestion, déclencheur HTTP vers l'Edge Function, tâches planifiées
-- Le secret est généré dans la base : il n'apparaît jamais dans le code.
-- L'URL de l'Edge Function pointe sur le projet de prod (lwfcgzhndwpffeebpjpy) : change-la si tu rejoues ce fichier ailleurs.

create schema if not exists private;
revoke all on schema private from anon, authenticated;
create table private.app_secrets (key text primary key, value text not null);
insert into private.app_secrets values ('ingest_secret', encode(gen_random_bytes(24),'hex'));

create or replace function public.get_ingest_secret() returns text language sql security definer set search_path = '' as
$$ select value from private.app_secrets where key = 'ingest_secret' $$;
revoke execute on function public.get_ingest_secret() from public, anon, authenticated;
grant execute on function public.get_ingest_secret() to service_role;

-- Appel asynchrone de l'Edge Function `ingest` (pg_net)
create or replace function private.run_ingest(payload jsonb) returns bigint
language sql security definer set search_path = '' as $$
  select net.http_post(
    url := 'https://lwfcgzhndwpffeebpjpy.supabase.co/functions/v1/ingest',
    headers := jsonb_build_object('Content-Type','application/json',
                                  'x-ingest-secret',(select value from private.app_secrets where key='ingest_secret')),
    body := payload, timeout_milliseconds := 150000);
$$;

-- Tâches planifiées (UTC) : 4 h UTC = 6 h Paris l'été
select cron.schedule('pepites-bodacc-daily', '0 4 * * *',
  $$select private.run_ingest(jsonb_build_object('mode','bodacc','date_debut',(current_date-3)::text,'max',500))$$);
select cron.schedule('pepites-enrich-1', '10 4 * * *',
  $$select private.run_ingest('{"mode":"enrich","batch":200}'::jsonb)$$);
select cron.schedule('pepites-enrich-2', '20 4 * * *',
  $$select private.run_ingest('{"mode":"enrich","batch":200}'::jsonb)$$);
select cron.schedule('pepites-cedants-weekly', '0 5 * * 1',
  $$select private.run_ingest('{"mode":"cedants","pages":8}'::jsonb)$$);
-- Rattrapage : enrichit toutes les 2 min tant qu'il reste des fiches non enrichies
select cron.schedule('pepites-backfill', '*/2 * * * *',
  $$select private.run_ingest('{"mode":"enrich","batch":200}'::jsonb) where exists (select 1 from public.companies where enriched_at is null)$$);
