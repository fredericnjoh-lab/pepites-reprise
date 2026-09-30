Le radar : signature de Filon. Chaque cible est une pépite placée sur la carte ; celles au-dessus du seuil brillent en or.

- À l'ouverture, un seul balayage de 1,4 s révèle les pépites dans l'ordre où le faisceau les touche. Jamais en boucle : le radar se tait ensuite.
- Props : `points` (`[{x, y, score, label?}]`, x et y entre 0 et 1, par exemple longitude et latitude normalisées sur l'Île-de-France), `size`, `hotThreshold` (70), `selected` (index), `onSelect(i, point)`.
- Un seul radar par écran, en tête du tableau de bord. `prefers-reduced-motion` coupe le balayage et affiche tout immédiatement.
