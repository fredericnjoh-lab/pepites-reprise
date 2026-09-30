# Pépites : spec et business model

Sep 27, 2026 · @Fred

Pépites détecte des PME rachetables à bas prix en Île-de-France et les monétise de trois façons : rachat en propre, abonnement repreneurs et success fee d'intermédiation. Objectif réaliste : environ 860 k€ de revenus en année 3 si 440 repreneurs s'abonnent et 12 cessions aboutissent.

## Spécification fonctionnelle

L'application sert trois utilisateurs : toi (rachat en propre et intermédiation), des repreneurs abonnés (V2) et des partenaires prescripteurs (V3).

| Module | Rôle | Règle métier clé |
| --- | --- | --- |
| Ingestion | Collecte quotidienne BODACC, Sirene/RNE, cédants 60+ | Dédoublonnage par SIREN ; clôtures pour insuffisance d'actif exclues |
| Scoring | Score Pépite 0-100 sur 4 axes | Poids réglables : cession 30 %, décote 25 %, qualité 25 %, potentiel 20 % |
| Valorisation | Fourchette indicative basse / haute | Rendement 4 à 7 × résultat net, multiple de CA sectoriel, décote de procédure (liquidation × 0,10-0,25, redressement × 0,30-0,50) |
| Recherche | Liste filtrable des cibles | Filtres : type, département, score, CA, âge du dirigeant, secteur |
| Fiche entreprise | Vue 360° d'une cible | Identité, dirigeants, finances, signaux, historique BODACC, valorisation |
| Pipeline | Suivi des dossiers | Détectée → Contactée → NDA → Data room → LOI → Closing (ou Perdu) ; mode rachat ou intermédiation |
| Approche IA | Premier message personnalisé | Destinataire = dirigeant, ou administrateur judiciaire si procédure ; mention d'opposition obligatoire |
| Alertes (à faire) | Email sur nouveaux signaux | Critères sauvegardés ; envoi quotidien à 7 h |
| Conformité | RGPD et opposition | Un SIREN en opposition sort du scoring et de l'affichage |

**Signaux calculés.**

- Cession : dirigeant de 60 ans et plus, entreprise de 20 ans et plus.
- Décote : procédure en cours, résultat négatif, baisse de CA de plus de 15 %.
- Valeur : marge nette de 8 % et plus, secteur fragmenté, certification RGE.

## Parcours utilisateur

**Toi, en rachat en propre.**

1. Chaque matin, tu ouvres l'onglet Cibles, filtré sur un score de 60 et plus.
2. Tu ouvres une fiche : signaux, finances, dirigeants, valorisation indicative.
3. Tu ajoutes la cible au pipeline en mode Rachat, avec une note.
4. Tu fais rédiger le message d'approche par Claude, tu l'ajustes et tu l'envoies.
5. Tu fais avancer le dossier : Contactée, NDA, Data room, LOI, Closing.

**Toi, en intermédiaire.**

1. Tu repères un cédant 60+ hors de ta cible personnelle et tu l'ajoutes en mode Intermédiation.
2. Tu obtiens un mandat de recherche d'acquéreur, signé avec les honoraires.
3. Tu publies un teaser anonymisé auprès des repreneurs abonnés (V2).
4. Tu dévoiles l'identité au repreneur après signature d'un NDA.
5. Au closing, tu factures le success fee via Fredjopartners.

**Repreneur abonné (V2).**

1. Il crée son profil : budget, apport, secteurs, départements.
2. Il reçoit des alertes et des teasers correspondant à son profil.
3. Il demande une mise en relation, signe le NDA en ligne et accède à la fiche complète.
4. Il suit ses dossiers dans son propre pipeline.

## État du MVP

Le MVP couvre 5 des 7 livrables du cahier des charges. Il manque les alertes email et la roadmap chiffrée, qui fait l'objet de ce document.

| Livrable | Statut | Détail |
| --- | --- | --- |
| Schéma Supabase + RLS | Livré | 16 tables, projet `pepites-reprise`, région Paris |
| Connecteurs d'ingestion | Livré | BODACC (procédures IDF et cessions de fonds), API Recherche d'entreprises (Sirene + RNE), cédants 60+ |
| Moteur de scoring | Livré | Fonction SQL, poids en table de config, réglables dans l'app |
| UI MVP | Livré | Cibles, fiche, pipeline, réglages, message IA |
| Jeu de test IDF | Livré | Multisecteur (IT, services B2B, industrie, négoce, transport, BTP) ; \~2 800 sociétés en base, enrichissement en cours |
| Alertes email | À faire | Besoin d'un service d'envoi (Resend ou Brevo) |
| Comptes INPI détaillés | À faire | Nécessaire pour l'EBE et l'actif net corrigé |

## Roadmap V2 et V3

On ne passe à la phase suivante que si la précédente a prouvé sa valeur : d'abord un premier deal signé, ensuite des repreneurs qui paient.

| Phase | Période | Contenu | Critère pour passer à la suite |
| --- | --- | --- | --- |
| V1.1 | Oct.-nov. 2026 | Alertes email, comptes INPI (EBE, actif net), annonces d'administrateurs judiciaires | 30 dirigeants contactés, 5 NDA signés |
| V2 | Déc. 2026-mars 2027 | Espace repreneur, matching cible ↔ repreneur, teasers anonymisés, NDA en ligne, abonnements Stripe | 1 mandat d'intermédiation signé ; 20 repreneurs en liste d'attente |
| V2.5 | Avr.-juin 2027 | Extension à 3 régions (Auvergne-Rhône-Alpes, Hauts-de-France, PACA), tous secteurs | 50 abonnés payants ; churn < 5 %/mois |
| V3 | Juil.-déc. 2027 | Data room sécurisée, audit préliminaire IA, simulateur LBO, annuaire partenaires avec apport d'affaires | 3 closings facturés ; 10 partenaires actifs |

**Stack V2.** Passage à Next.js sur Vercel, avec Supabase Auth pour les comptes repreneurs. L'artifact actuel reste ton cockpit privé.

## Modèle de revenus

Le success fee pèse le plus dès l'année 1. L'abonnement apporte la récurrence à partir de l'année 2. Les rachats en propre ne sont pas comptés ici : ils créent de la valeur patrimoniale, pas du chiffre d'affaires Pépites.

**Grille d'abonnement repreneurs (HT, par mois).**

| Offre | Prix | Contenu |
| --- | --- | --- |
| Solo | 49 € | Base IDF, filtres, 3 alertes, 10 fiches complètes/mois |
| Pro | 149 € | Toutes régions, alertes illimitées, teasers en avant-première, pipeline |
| Cabinet | 399 € | 5 utilisateurs, export, API, marque blanche pour conseils et family offices |

**Success fee, barème de type Lehman sur le prix de cession.** 5 % jusqu'à 1 M€, 4 % de 1 à 2 M€, 3 % de 2 à 3 M€, 2 % de 3 à 4 M€, 1 % au-delà, avec un minimum de 15 k€. Exemples : 20 k€ pour une cession à 400 k€, 35 k€ à 700 k€, 105 k€ à 2,5 M€.

**Leads partenaires.** 80 € par lead qualifié (cédant ou repreneur), vendu aux experts-comptables, avocats et banques.

**Projection sur 3 ans (en euros).**

|  | Année 1 | Année 2 | Année 3 |
| --- | --- | --- | --- |
| Abonnés en fin d'année (Solo / Pro / Cabinet) | 30 / 12 / 3 | 120 / 45 / 12 | 300 / 110 / 30 |
| Revenu récurrent mensuel en fin d'année | 4 455 | 17 373 | 43 060 |
| Abonnements (sur l'année) | 26 730 | 130 968 | 362 598 |
| Success fees | 40 000 (2 × 400 k€) | 150 000 (6 × 500 k€) | 420 000 (12 × 700 k€) |
| Leads partenaires | 8 000 (100) | 32 000 (400) | 80 000 (1 000) |
| **Total** | **74 730** | **312 968** | **862 598** |

Le revenu d'abonnement annuel est calculé sur la moyenne du début et de la fin d'année, en supposant une croissance linéaire. Les coûts d'infrastructure restent faibles (moins de 150 €/mois en année 1 : Supabase, Vercel, envoi d'emails). Le poste principal sera l'acquisition et le temps passé sur les dossiers.

## Conformité et prochaines actions

Deux sujets juridiques conditionnent la monétisation : le cadre de l'intermédiation et le RGPD des dirigeants. Ces points sont à valider avec un avocat. Ce document n'est pas un conseil juridique.

- **Loi Hoguet.** Une cession de fonds de commerce peut exiger une carte professionnelle T. Une cession de titres (parts, actions) y échappe en principe. Le type d'opérations et de mandats à accepter en dépend.
- **RGPD.** La base légale est l'intérêt légitime : à documenter dans une analyse (LIA) et un registre des traitements. Chaque premier contact doit informer la personne, et la table d'opposition doit être tenue à jour.
- **Mandats et NDA.** Modèles à faire rédiger : mandat de recherche d'acquéreur, mandat de recherche de cible, NDA bilatéral.

**Prochaines actions.**

- [ ] Choisir 20 cibles de score 70 et plus dans l'app et lancer les approches
- [ ] Valider avec un avocat le périmètre Hoguet et les modèles de mandat et de NDA
- [ ] Brancher les alertes email (Resend ou Brevo)
- [ ] Ajouter les comptes INPI pour calculer l'EBE et l'actif net corrigé
- [ ] Ouvrir une liste d'attente repreneurs pour valider la grille de prix avant la V2
