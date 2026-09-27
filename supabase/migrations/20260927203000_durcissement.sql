-- FILON — durcissement sécurité et performance (audit advisors Supabase du 27/09/2026)
--
-- 1. Lecture des données : seuls les comptes marqués « filon_admin » dans app_metadata
--    (non modifiable par l'utilisateur) lisent les tables. Avant : tout compte authentifié,
--    or l'inscription Supabase Auth est ouverte par défaut.
-- 2. private.run_ingest n'est plus exécutable par PUBLIC (défense en profondeur).
-- 3. Politiques « propriétaire » : (select auth.uid()) évalué une fois par requête.
-- 4. Index sur les clés étrangères de matches.

create or replace function public.is_filon_admin() returns boolean
language sql stable security invoker set search_path = '' as $$
  select coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', '') = 'filon_admin'
$$;
revoke execute on function public.is_filon_admin() from public, anon;
grant execute on function public.is_filon_admin() to authenticated;

do $$ declare t text; begin
  for t in select unnest(array['companies','officers','financials','legal_events','listings','signals','scoring_config','scores','valuations','sources_log']) loop
    execute format('drop policy if exists "lecture authentifiee" on public.%I', t);
    execute format('create policy "lecture admin filon" on public.%I for select to authenticated using ((select public.is_filon_admin()))', t);
  end loop;
  for t in select unnest(array['deals','buyers','alerts']) loop
    execute format('drop policy if exists "proprietaire" on public.%I', t);
    execute format('create policy "proprietaire" on public.%I for all to authenticated using (owner = (select auth.uid())) with check (owner = (select auth.uid()))', t);
  end loop;
end $$;

drop policy if exists "via buyer" on public.matches;
create policy "via buyer" on public.matches for all to authenticated
  using (exists (select 1 from public.buyers b where b.id = buyer_id and b.owner = (select auth.uid())))
  with check (exists (select 1 from public.buyers b where b.id = buyer_id and b.owner = (select auth.uid())));

revoke execute on function private.run_ingest(jsonb) from public, anon, authenticated;

create index if not exists matches_buyer_id_idx on public.matches (buyer_id);
create index if not exists matches_siren_idx on public.matches (siren);

-- opposition_rgpd : RLS sans politique = volontaire (lecture et écriture réservées au back-office).
comment on table public.opposition_rgpd is 'Droit d''opposition RGPD. Aucune politique RLS : accès réservé au rôle postgres / service_role.';
