Filon repère les entreprises françaises à reprendre avant tout le monde : procédures collectives, dirigeants de 60 ans et plus, pépites sous-évaluées. La marque est un radar. Un noir profond, des filets fins, et un seul éclat d'or pour ce qui mérite l'attention. Tout le reste se tait.

## Principes

1. **Le noir d'abord.** Le thème Nuit est la référence ; Jour en est la traduction fidèle, pas l'inverse.
2. **Un seul or.** `gold` et `gold-fill` signalent une seule chose à la fois : la meilleure cible, l'action principale, le point sélectionné. Si deux éléments brillent, l'un des deux a tort.
3. **La donnée est le décor.** Pas d'illustration ni de photo. La matrice de points de la carte, les anneaux du radar et les chiffres tabulaires font l'esthétique.
4. **De la lumière, pas de la couleur.** Le futurisme vient de la lumière : un halo `ambient` derrière le radar, un `bloom` autour de ce qui est or, des tuiles en verre dépoli (`glass`, liseré `glass-edge`). Jamais une deuxième couleur d'accent.
5. **Un seul moment spectaculaire.** Le balayage du radar à l'ouverture (1,6 s, une fois), qui allume les pépites puis fait apparaître les étiquettes des trois meilleures. Le reste bouge en 160 ms, sans rebond.

## Ton et écriture

- Français, vouvoiement dans les messages aux cédants, tutoiement interdit dans l'interface (on s'adresse à un professionnel sans le nommer : « Ajouter au pipeline », pas « Ajoute »).
- Des faits chiffrés, jamais d'adjectifs : « Dirigeant de 77 ans · CA 11,7 M€ · marge 5,1 % », pas « Excellente opportunité ».
- Phrases courtes, pas de points d'exclamation, pas d'emoji, pas de jargon anglais quand le français existe (« cible », « cédant », « repreneur », « décote »).
- Les valorisations sont toujours qualifiées d'indicatives.
- Signature : « Trouver le filon. » Accroche : « Le radar des entreprises à reprendre. »

## Couleur

- Fond de page `void`, panneaux `surface-1`, survols et colonnes `surface-2`. Séparer par des filets `line` de 1px, jamais par des ombres.
- Texte `ink` ; libellés, unités et texte secondaire `ink-muted`.
- `gold` pour un texte ou un chiffre accentué ; `gold-fill` pour un aplat (bouton principal, pépite). Sur un aplat or, écrire en `on-gold`.
- Signaux : `cession` (vert d'eau) pour la probabilité de cession, `decote` (corail) pour la décote et les procédures, `gold` pour la valeur cachée. Chaque signal porte toujours son mot et son chiffre : la couleur ne dit jamais rien seule.
- Bordures de champs et boutons secondaires : `line-strong` (≥ 3:1). Anneau de focus : `focus`, 2px plein, décalé de 2px.

## Typographie

- **Michroma** (`display-xl`, `display-md`) : le logotype, un titre par écran, le nom d'une entreprise en capitales dans sa fiche. Jamais pour un paragraphe ni un chiffre.
- **Geist** (`title`, `body`, `label`) : toute l'interface. Les libellés `label` en capitales espacées, couleur `ink-muted`.
- **Geist Mono** (`score`, `figure`) : chaque chiffre, SIREN, montant et date, en chiffres tabulaires. Le Score Pépite s'écrit en `score`.
- Les trois familles sont hébergées par Google Fonts (`Michroma`, `Geist`, `Geist Mono`).

## Mise en page : le bento

- L'écran d'accueil est une grille bento de 12 colonnes, écart `space-3`, tuiles `radius-lg` en `glass` avec flou de 16px et liseré `glass-edge`.
- Tuile maîtresse : le Radar (7 colonnes, 2 rangées), avec sa matrice de points hexagonale dont la densité suit le nombre de cibles, et des étiquettes flottantes en pilule reliées par un filet or aux trois meilleures pépites.
- Autour : l'accroche et 4 chiffres clés (Geist Mono 34px, celui en or porte un `bloom`), les meilleures pépites, puis trois tuiles d'égale largeur (pépites par département, flux BODACC, pipeline).
- Au survol, un projecteur `ambient` suit le curseur sur la tuile. Il disparaît avec `prefers-reduced-motion`.

## Espace, formes et mouvement

- Grille de 4px : `space-1` à `space-12`. Marges latérales `space-4` minimum, panneaux `space-6`.
- `radius-xs` (2px) pour les puces et étiquettes, `radius-sm` (6px) pour boutons et champs, `radius-lg` (14px) pour les tuiles bento, `radius-full` pour les cercles et les pilules flottantes.
- Pas d'ombre portée : seulement `glow-gold` (sélection, bouton principal au survol) et la lueur `bloom` des éléments or.
- Mouvement : `duration-sweep` pour le balayage d'ouverture, `duration-ui` pour tout le reste, courbe douce sans rebond. Respecter `prefers-reduced-motion` : le radar apparaît alors immédiatement.

## Composants

- `Radar` : la signature, un seul par écran, en tête du tableau de bord.
- `ScoreDial` : le Score Pépite d'une cible, en tête de fiche et sur les cartes du pipeline.
- `SignalChip` : un signal détecté, chiffre compris.
- `ProcedureTag` : la situation juridique (liquidation, redressement, sauvegarde, cédant potentiel, veille).
- `Button` : `primary` pour l'unique action principale, `ghost` pour le reste.

## Logo

- Symbole : un radar dont l'aiguille pointe une pépite or. Logotype : FILON en capitales géométriques, le O est le radar avec sa pépite au centre.
- Utiliser `filon-*-on-dark.svg` sur Nuit et `filon-*-on-light.svg` sur Jour. La pépite reste toujours or.
- Pas d'icônes décoratives : les seuls pictogrammes sont les points, les anneaux et les filets du radar.
