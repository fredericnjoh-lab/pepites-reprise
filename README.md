# Pépites Reprise

Détection de PME rachetables à bas prix en Île-de-France (pilote BTP et maintenance), pour un rachat en propre ou une intermédiation.

Les données viennent du BODACC (procédures collectives), de Sirene et du RNE (via l'API Recherche d'entreprises). Chaque cible reçoit un **Score Pépite** sur 100 et une valorisation indicative.

## Structure

```
supabase/
  migrations/
    20260926234103_schema.sql          # tables, deal flow, RLS
    20260926234202_scoring.sql         # vue v_company_facts, compute_scores()
    20260926234227_ingestion_cron.sql  # secret, run_ingest(), tâches pg_cron
  functions/ingest/index.ts            # Edge Function : BODACC, enrichissement, cédants 60+
cockpit/index.html                     # cockpit privé (artifact Claude, lit la base via le connecteur Supabase)
docs/spec-et-business-model.md         # spec fonctionnelle, roadmap, modèle de revenus
.cursor/rules/                         # contexte projet pour l'agent Cursor
```

## Infra

| Élément | Valeur |
| --- | --- |
| Projet Supabase | `pepites-reprise` (ref `lwfcgzhndwpffeebpjpy`, région eu-west-3 Paris) |
| Edge Function | `ingest`, `verify_jwt = false`, protégée par l'en-tête `x-ingest-secret` |
| Planification | pg_cron : BODACC chaque jour 4 h UTC, enrichissement 4 h 10 et 4 h 20, cédants le lundi 5 h UTC, rattrapage toutes les 2 min |

## Démarrer

```bash
npm i -g supabase
supabase login
supabase link --project-ref lwfcgzhndwpffeebpjpy
supabase functions deploy ingest --no-verify-jwt
supabase db push            # uniquement sur un projet vierge : la prod a déjà ces migrations
```

Déclencher une ingestion à la main (SQL, depuis l'éditeur Supabase) :

```sql
select private.run_ingest('{"mode":"bodacc","max":500}'::jsonb);
select private.run_ingest('{"mode":"enrich","batch":200}'::jsonb);
select private.run_ingest('{"mode":"cedants","pages":8}'::jsonb);
select public.compute_scores();
```

## Score Pépite

Moyenne pondérée de quatre axes (0 à 100), poids dans `scoring_config` : probabilité de cession 30 %, décote 25 %, qualité 25 %, potentiel 20 %. Les poids se règlent dans l'onglet « Scoring et sources » du cockpit.

## Conformité

- Dirigeants = personnes physiques : base légale « intérêt légitime », information au premier contact, droit d'opposition via `opposition_rgpd` (le SIREN sort du scoring).
- Valorisations indicatives : pas un conseil en investissement.
- Intermédiation sur fonds de commerce : vérifier la loi Hoguet avec un avocat.

## Secrets

Aucun secret dans ce dépôt. Le secret d'ingestion est généré dans `private.app_secrets`. Ne jamais committer de clé `service_role` ni de fichier `.env`.
