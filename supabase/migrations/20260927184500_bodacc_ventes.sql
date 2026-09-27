-- PÉPITES — cessions de fonds publiées au BODACC (famille « vente »)
-- Une nouvelle migration : le schéma déjà appliqué n'est pas modifié en place.

alter table public.listings
  add column if not exists external_id text,
  add column if not exists siren_cedant text references public.companies (siren) on delete set null,
  add column if not exists sirens text[] not null default '{}',
  add column if not exists date_parution date,
  add column if not exists departement text,
  add column if not exists commune text,
  add column if not exists activite text,
  add column if not exists nature text;

alter table public.listings
  add constraint listings_external_id_key unique (external_id);
create index if not exists listings_siren_idx on public.listings (siren);
create index if not exists listings_siren_cedant_idx on public.listings (siren_cedant);
create index if not exists listings_sirens_idx on public.listings using gin (sirens);
create index if not exists listings_date_idx on public.listings (date_parution desc);

-- Veille quotidienne, juste après les procédures collectives (4 h 05 UTC).
do $$
begin
  if exists (select 1 from cron.job where jobname = 'pepites-ventes-daily') then
    perform cron.unschedule('pepites-ventes-daily');
  end if;
end $$;

select cron.schedule('pepites-ventes-daily', '5 4 * * *',
  $$select private.run_ingest(jsonb_build_object('mode','ventes','date_debut',(current_date-7)::text,'max',800))$$);
