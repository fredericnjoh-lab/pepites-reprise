-- PÉPITES — 1/3 : schéma, référentiel, deal flow, RLS

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- ---------- Référentiel ----------
create table public.companies (
  siren text primary key check (siren ~ '^[0-9]{9}$'),
  nom text,
  naf text,
  section_naf text,
  categorie text,
  tranche_effectif text,
  nature_juridique text,
  date_creation date,
  etat_administratif text,
  departement text,
  code_postal text,
  commune text,
  adresse text,
  latitude double precision,
  longitude double precision,
  nb_etablissements int,
  est_rge boolean,
  source text,                 -- bodacc_collective | sirene_cedant
  enriched_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index on public.companies (departement);
create index on public.companies (naf);

create table public.officers (
  id bigserial primary key,
  siren text references public.companies on delete cascade,
  nom text, prenoms text,
  annee_naissance int,
  qualite text,
  type_dirigeant text,
  unique (siren, nom, prenoms, qualite)
);
create index on public.officers (siren);

create table public.financials (
  siren text references public.companies on delete cascade,
  annee int,
  ca numeric,
  resultat_net numeric,
  primary key (siren, annee)
);

create table public.legal_events (
  id text primary key,          -- id BODACC
  siren text references public.companies on delete cascade,
  date_parution date,
  famille text,
  nature text,
  date_jugement date,
  complement text,
  tribunal text,
  url text,
  raw jsonb
);
create index on public.legal_events (siren);
create index on public.legal_events (date_parution desc);

create table public.listings (
  id bigserial primary key,
  siren text references public.companies on delete set null,
  source text, titre text, prix_demande numeric, url text, raw jsonb,
  created_at timestamptz default now()
);

create table public.signals (
  siren text references public.companies on delete cascade,
  code text,
  categorie text,               -- cession | decote | valeur
  libelle text,
  detected_at timestamptz default now(),
  primary key (siren, code)
);

create table public.scoring_config (
  key text primary key,
  weight numeric not null,
  label text
);
insert into public.scoring_config values
 ('p_cession', 0.30, 'Probabilité de cession'),
 ('decote',    0.25, 'Décote estimée'),
 ('qualite',   0.25, 'Qualité du business'),
 ('potentiel', 0.20, 'Potentiel de création de valeur');

create table public.scores (
  siren text primary key references public.companies on delete cascade,
  score numeric, p_cession numeric, decote numeric, qualite numeric, potentiel numeric,
  computed_at timestamptz default now()
);

create table public.valuations (
  siren text primary key references public.companies on delete cascade,
  methode_rendement_bas numeric, methode_rendement_haut numeric,
  methode_ca_bas numeric, methode_ca_haut numeric,
  fourchette_bas numeric, fourchette_haut numeric,
  hypotheses jsonb,
  computed_at timestamptz default now()
);

-- ---------- Deal flow / marketplace ----------
create type public.deal_stage as enum ('detectee','contactee','nda','data_room','loi','closing','perdu');
create table public.deals (
  id bigserial primary key,
  siren text references public.companies on delete cascade,
  stage public.deal_stage default 'detectee',
  mode text default 'rachat',   -- rachat | intermediation
  notes text,
  next_action text,
  owner uuid default auth.uid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (siren, owner)
);

create table public.buyers (
  id bigserial primary key, owner uuid default auth.uid(),
  nom text, email text, budget_min numeric, budget_max numeric,
  secteurs text[], departements text[], apport numeric, notes text,
  created_at timestamptz default now()
);
create table public.matches (
  id bigserial primary key,
  buyer_id bigint references public.buyers on delete cascade,
  siren text references public.companies on delete cascade,
  score numeric, statut text default 'propose', nda_signe boolean default false,
  success_fee_pct numeric, created_at timestamptz default now()
);
create table public.alerts (
  id bigserial primary key, owner uuid default auth.uid(),
  nom text, criteres jsonb, email text, actif boolean default true,
  last_run timestamptz, created_at timestamptz default now()
);
create table public.sources_log (
  id bigserial primary key,
  source text, params jsonb, nb_items int, statut text, message text,
  started_at timestamptz default now(), finished_at timestamptz
);

-- RGPD : droit d'opposition
create table public.opposition_rgpd (
  siren text primary key, demande_le timestamptz default now(), motif text
);

-- ---------- RLS : tout fermé par défaut ; lecture pour utilisateurs authentifiés ----------
do $$ declare t text; begin
  for t in select unnest(array['companies','officers','financials','legal_events','listings','signals','scoring_config','scores','valuations','sources_log']) loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "lecture authentifiee" on public.%I for select to authenticated using (true)', t);
  end loop;
  for t in select unnest(array['deals','buyers','alerts']) loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "proprietaire" on public.%I for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid())', t);
  end loop;
end $$;
alter table public.matches enable row level security;
create policy "via buyer" on public.matches for all to authenticated
  using (exists (select 1 from public.buyers b where b.id = buyer_id and b.owner = auth.uid()))
  with check (exists (select 1 from public.buyers b where b.id = buyer_id and b.owner = auth.uid()));
alter table public.opposition_rgpd enable row level security;
