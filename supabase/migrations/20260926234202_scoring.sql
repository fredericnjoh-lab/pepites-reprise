-- PÉPITES — 2/3 : vue des faits, signaux, Score Pépite, valorisation indicative
-- (état actuel en production : inclut la vue v2 appliquée le 2026-09-26)

create or replace view public.v_company_facts as
with dir as (
  select siren,
         max(extract(year from now())::int - annee_naissance) filter (
           where type_dirigeant = 'personne physique' and annee_naissance is not null
             and coalesce(qualite,'') !~* 'commissaire') as age_dirigeant_max
  from public.officers group by siren
), fin as (
  select distinct on (siren) siren, annee, ca, resultat_net,
         lead(ca) over (partition by siren order by annee desc) as ca_prev
  from public.financials order by siren, annee desc
), ev as (
  select siren, date_jugement, date_parution, nature,
    case
      when nature ~* 'cl[oô]ture' then 'cloture'
      when nature ~* 'plan de cession' then 'plan_cession'
      when nature ~* 'liquidation' then 'liquidation'
      when nature ~* '^jugement (de|modifiant le|arr[eê]tant le) plan' then 'sauvegarde'
      when nature ~* 'redressement' then 'redressement'
      when nature ~* 'sauvegarde' then 'sauvegarde'
      else 'autre' end as procedure
  from public.legal_events where famille = 'collective'
), proc as (
  select distinct on (siren) * from ev where procedure <> 'autre' order by siren, date_parution desc
)
select c.siren, c.nom, c.naf, c.section_naf, c.tranche_effectif, c.est_rge,
       c.departement, c.date_creation,
       extract(year from age(now(), c.date_creation))::int as anciennete,
       dir.age_dirigeant_max,
       fin.annee as annee_fin, fin.ca, fin.resultat_net, fin.ca_prev,
       case when fin.ca > 0 then fin.resultat_net / fin.ca end as marge_nette,
       proc.procedure, proc.nature as derniere_nature, proc.date_parution as date_procedure
from public.companies c
left join dir using (siren) left join fin using (siren) left join proc using (siren)
where not exists (select 1 from public.opposition_rgpd o where o.siren = c.siren);

create or replace function public.compute_scores()
returns int language plpgsql security definer set search_path = public as $$
declare w record; n int;
begin
  select
    max(weight) filter (where key='p_cession') p, max(weight) filter (where key='decote') d,
    max(weight) filter (where key='qualite') q, max(weight) filter (where key='potentiel') v
  into w from scoring_config;

  -- ----- signaux -----
  delete from signals where true;
  insert into signals (siren, code, categorie, libelle)
  select siren, code, cat, lib from (
    select siren, 'dirigeant_60plus' code, 'cession' cat, 'Dirigeant de '||age_dirigeant_max||' ans' lib from v_company_facts where age_dirigeant_max >= 60
    union all select siren, 'anciennete_20ans','cession','Entreprise de '||anciennete||' ans' from v_company_facts where anciennete >= 20
    union all select siren, 'proc_'||procedure,'decote', derniere_nature from v_company_facts where procedure in ('redressement','liquidation','sauvegarde','plan_cession')
    union all select siren, 'resultat_negatif','decote','Résultat net négatif ('||annee_fin||')' from v_company_facts where resultat_net < 0
    union all select siren, 'baisse_ca','decote','CA en baisse de '||round((1-ca/ca_prev)*100)||' %' from v_company_facts where ca_prev > 0 and ca < ca_prev*0.85
    union all select siren, 'marge_elevee','valeur','Marge nette '||round(marge_nette*100,1)||' %' from v_company_facts where marge_nette >= 0.08
    union all select siren, 'secteur_fragmente','valeur','Secteur fragmenté (build-up)' from v_company_facts
       where section_naf = 'F' or naf ~ '^(33|43|81|38)\.' or naf in ('45.20A','45.20B','49.41A','49.41B')
    union all select siren, 'rge','valeur','Certifié RGE' from v_company_facts where est_rge
  ) s on conflict do nothing;

  -- ----- scores -----
  insert into scores (siren, p_cession, decote, qualite, potentiel, score, computed_at)
  select siren, p, d, q, v, round(p*w.p + d*w.d + q*w.q + v*w.v), now() from (
    select f.siren,
      least(100, greatest(
        case when age_dirigeant_max >= 70 then 90 when age_dirigeant_max >= 65 then 80
             when age_dirigeant_max >= 60 then 65 when age_dirigeant_max >= 55 then 35
             when age_dirigeant_max is null then 20 else 10 end,
        case procedure when 'liquidation' then 90 when 'redressement' then 85
             when 'plan_cession' then 70 when 'sauvegarde' then 55 else 0 end)
        + case when anciennete >= 20 then 10 else 0 end) as p,
      least(100, greatest(20,
        case procedure when 'liquidation' then 90 when 'redressement' then 80 when 'sauvegarde' then 60 else 0 end,
        case when resultat_net < 0 then 55 else 0 end,
        case when age_dirigeant_max >= 65 and procedure is null then 35 else 0 end)
        + case when ca_prev > 0 and ca < ca_prev*0.85 then 15 else 0 end) as d,
      least(100,
        least(coalesce(anciennete,0),30)/30.0*35
        + case when ca >= 5e6 then 30 when ca >= 1e6 then 25 when ca >= 3e5 then 15 when ca > 0 then 8 else 5 end
        + case when marge_nette >= 0.08 then 25 when marge_nette >= 0.03 then 18 when marge_nette >= 0 then 10
               when marge_nette < 0 then 3 else 8 end
        + case when tranche_effectif >= '11' and tranche_effectif <> 'NN' then 10 else 0 end) as q,
      least(100,
        case when section_naf = 'F' or naf ~ '^(33|43|81|38)\.' then 35 else 15 end
        + case when est_rge then 15 else 0 end
        + case when tranche_effectif between '02' and '22' then 20 else 0 end
        + case when ca between 5e5 and 2e7 then 20 else 0 end
        + case when procedure in ('redressement','sauvegarde') and ca >= 1e6 then 10 else 0 end) as v
    from v_company_facts f
    where coalesce(procedure,'') not in ('cloture','autre')
  ) x
  on conflict (siren) do update set p_cession=excluded.p_cession, decote=excluded.decote,
    qualite=excluded.qualite, potentiel=excluded.potentiel, score=excluded.score, computed_at=now();

  delete from scores s where exists (select 1 from v_company_facts f where f.siren=s.siren and f.procedure in ('cloture','autre'));

  -- ----- valorisation indicative -----
  insert into valuations (siren, methode_rendement_bas, methode_rendement_haut, methode_ca_bas, methode_ca_haut,
                          fourchette_bas, fourchette_haut, hypotheses, computed_at)
  select siren, rb, rh, cb, ch,
         round(coalesce((coalesce(rb,cb)+coalesce(cb,rb))/2, 0)),
         round(coalesce((coalesce(rh,ch)+coalesce(ch,rh))/2, 0)),
         jsonb_build_object('multiple_ca', mult, 'decote_procedure', dec,
           'note','Indicatif. Actif net corrigé à compléter avec les comptes INPI. Ne constitue pas un conseil.'),
         now()
  from (
    select siren,
      case when resultat_net > 0 then round(resultat_net*4*dec_lo) end rb,
      case when resultat_net > 0 then round(resultat_net*7*dec_hi) end rh,
      case when ca > 0 then round(ca*mult_lo*dec_lo) end cb,
      case when ca > 0 then round(ca*mult_hi*dec_hi) end ch,
      array[mult_lo, mult_hi] mult, array[dec_lo, dec_hi] dec
    from (
      select f.*,
        case when section_naf='F' then 0.25 when section_naf='C' or naf ~ '^33\.' then 0.35 else 0.30 end mult_lo,
        case when section_naf='F' then 0.50 when section_naf='C' or naf ~ '^33\.' then 0.70 else 0.60 end mult_hi,
        case procedure when 'liquidation' then 0.10 when 'redressement' then 0.30 when 'sauvegarde' then 0.60 else 1 end dec_lo,
        case procedure when 'liquidation' then 0.25 when 'redressement' then 0.50 when 'sauvegarde' then 0.80 else 1 end dec_hi
      from v_company_facts f
    ) a where ca > 0 or resultat_net > 0
  ) b
  on conflict (siren) do update set methode_rendement_bas=excluded.methode_rendement_bas,
    methode_rendement_haut=excluded.methode_rendement_haut, methode_ca_bas=excluded.methode_ca_bas,
    methode_ca_haut=excluded.methode_ca_haut, fourchette_bas=excluded.fourchette_bas,
    fourchette_haut=excluded.fourchette_haut, hypotheses=excluded.hypotheses, computed_at=now();

  select count(*) into n from scores;
  return n;
end $$;
revoke execute on function public.compute_scores() from anon, authenticated;
grant execute on function public.compute_scores() to service_role;
