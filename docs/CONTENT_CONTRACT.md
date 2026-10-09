# Contrat de contenu — VEILLEUSE

Ce document est la **référence unique** pour produire le contenu du jeu (pixel art, tuiles, ennemis, musique,
illustrations, cartes, scénario). Chaque fichier de contenu a **un seul propriétaire** ; tout le reste du code est
considéré comme stable. Lire aussi `docs/GAME_DESIGN.md` (histoire, personnages, systèmes).

- Résolution interne : **320×180**. Tuiles : **16×16**. Personnages : **16×24**.
- Langue de tout le texte affiché : **français** (accents, « guillemets », … autorisés : la police les gère).
- Ne jamais modifier un fichier dont on n'est pas propriétaire. Ne pas modifier le moteur (`src/engine`, `src/game/*`
  hors `src/game/story/<son module>`), sauf demande explicite.

---

## 0. Outils de vérification (à utiliser systématiquement)

```bash
npx tsc --noEmit                 # types (des erreurs dans les fichiers d'autres équipes peuvent apparaître : les ignorer)
npx vitest run tests/content.test.ts   # validation du contenu (clés, cartes, ennemis, musique…)
node tools/shot.mjs "<query>" <sortie.png> [--wait ms] [--keys "Code,Code:ms,wait:ms"] [--shots "ms,ms"]
```

Requêtes utiles pour `tools/shot.mjs` (la capture PNG peut ensuite être **lue** pour juger le rendu) :

| Requête | Effet |
|---|---|
| `debug=sheet&filter=b_&scale=4` | planche de tous les sprites dont la clé commence par `b_` (agrandis ×4) |
| `debug=sheet&filter=noa&chars&scale=4` | toutes les frames du personnage `noa` (`chars` inclut les personnages animés) |
| `debug=map&map=prairie&spawn=default&chapter=1&party=mina` | charge une carte directement |
| `debug=battle&enemies=nuage&chapter=1` | lance un combat (mode tutoriel : on ne peut pas perdre) |
| `debug=pattern&id=rain&emotion=tristesse&power=1` | boucle sur un motif d'attaque |
| `debug=image&key=souvenir_fenetre` | affiche une illustration |
| `debug=script&name=<nom>&map=<carte>` | joue un script de `DEBUG` (voir § 8) |
| `debug=title` | écran titre |

Touches : flèches = déplacement, `KeyZ`/`Enter` = A (valider), `KeyX`/`Escape` = B, `KeyC` = menu.
Exemple : `node tools/shot.mjs "debug=map&map=village" /tmp/v.png --keys "ArrowUp:800,KeyZ,wait:600"`.

Les captures font 1280×720 (le jeu ×4). Mettre les captures dans le scratchpad, **jamais** dans le dépôt.

Bot de test (`tools/play.mjs`, étapes de haut niveau : `auto`, `choose:N`, `write:mot`, `interact:id`…) et scénarios
rejouables : `node tools/play.mjs --scenario tools/scenarios/<fichier>.txt` ou `node tools/run-scenarios.mjs [filtres]`
(format dans `tools/scenarios/README.md` ; chaque lot y range ses preuves, `v11-…` vérifient que la 1.1 joue encore).

---

## 1. Pixel art — format et style

### 1.1 Format

Un sprite est un *template string* : une ligne = une rangée de pixels, un caractère = une couleur de la palette,
`.` = transparent. L'indentation commune est retirée automatiquement ; les rangées plus courtes sont complétées.

```ts
export const ART: Record<string, SpriteDef> = {
  prop_rock: `
    ....kkkk....
    ..kkgggWkk..
    .kgggggggWk.
    kGgggggggggk
    kGGgggggggGk
    .kkGGGGGGkk.
  `,
  // Options : couleurs propres au sprite, contour automatique (+1 px autour), point d'ancrage
  b_nuage: { art: `...`, outline: 'k', colors: { '6': '#c0d0e8' } },
};
```

- **Ancre** par défaut : bas-centre (`ax = floor(largeur/2)`, `ay = hauteur`). Les tuiles font exactement 16×16.
- `outline: 'k'` ajoute un contour de 1 px (le sprite grandit de 2 px) — pratique pour les ennemis et gros props.
- `colors: { X: '#hex' }` ajoute des couleurs locales (n'importe quel caractère non utilisé, ex. chiffres `6-9`).
- Variantes automatiques : un module peut exporter `VARIANTS = ['real', 'ink']` : chaque sprite est aussi construit
  en version « monde réel » (désaturée, bleutée) et « encre » (corrompue). Le moteur choisit `clé@real` / `clé@ink`
  selon le monde de la carte. **Ne pas dessiner ces variantes à la main.**
- Animation : une frame supplémentaire `<clé>_2` est utilisée automatiquement pour les ennemis (combat et carte) ;
  pour les PNJ/props, lister les frames explicitement (`frames: ['npc_dodo', 'npc_dodo_2']`).

### 1.2 Palette (caractères → couleurs)

| Car. | Couleur | Usage | Car. | Couleur | Usage |
|---|---|---|---|---|---|
| `k` | `#1c1424` | **contour** (prune très sombre) | `K` | `#2d2238` | ombre profonde |
| `w` | `#fffaf2` | blanc chaud | `W` | `#ece2df` | blanc ombré |
| `g` | `#b7aab8` | gris lavande clair | `G` | `#7d6f86` | gris moyen |
| `d` | `#4e4359` | gris sombre | `i` | `#0b0710` | encre noire |
| `s` | `#fbd7c0` | peau | `S` | `#eeb39b` | peau ombre |
| `t` | `#c98572` | peau sombre / bouche | `f` | `#ffffff` | reflet pur |
| `h` | `#3f3d63` | cheveux de Noa | `H` | `#2b2946` | cheveux ombre |
| `m` | `#e0834f` | cheveux de Mina | `M` | `#b05a3a` | cheveux Mina ombre |
| `b` | `#a7c7f0` | bleu pastel | `B` | `#6d8fd6` | bleu |
| `n` | `#3d4c8f` | bleu marine | `a` | `#b0f0e6` | aqua clair |
| `A` | `#5fbfc4` | sarcelle | `p` | `#f8b6cf` | rose |
| `P` | `#e07ba5` | rose foncé | `r` | `#e8505b` | rouge |
| `R` | `#a8324a` | rouge sombre | `y` | `#ffe991` | jaune |
| `Y` | `#f5c04f` | jaune doré | `o` | `#f09a4a` | orange |
| `O` | `#c46a2e` | orange brûlé | `l` | `#c4ecaa` | vert clair |
| `L` | `#8fd28a` | vert | `e` | `#5aa76a` | vert foncé |
| `E` | `#3a7558` | vert profond | `v` | `#d4b8f0` | lavande |
| `V` | `#9a7bd0` | violet | `u` | `#63489a` | violet profond |
| `c` | `#dcb488` | bois clair | `C` | `#a8774f` | bois |
| `x` | `#6e4a3a` | bois sombre | `q` | `#fff3cf` | crème |
| `Q` | `#ecd3a0` | crème ombre | `0` | `#000000` | noir pur (rare) |
| `z` | `#22243a` | nuit 1 | `Z` | `#15172a` | nuit 0 (la plus sombre) |
| `j` | `#33365a` | nuit 2 | `J` | `#4a4e78` | nuit 3 |
| `1` | `#5c6080` | mur réel | `2` | `#3e4160` | mur réel sombre |
| `3` | `#6d7398` | mur réel clair | `4` | `#8a8fb0` | gris bleuté clair |
| `5` | `#2a2c44` | nuit 1.5 | | | |

### 1.3 Guide de style

- Inspiration **OMORI** (rêve pastel, contours doux) et **Undertale** (lisibilité, silhouettes fortes).
- **Contour `k`** autour des personnages, ennemis et objets ; pas de contour noir pur.
- Lumière venant du **haut-gauche** : ombre en bas-droite, 2–3 tons par matière, un reflet ponctuel (`w`/`f`).
- Personnages **chibi** : tête ≈ 55–60 % de la hauteur. Pas d'anti-crénelage, pas de pixels orphelins.
- Monde du rêve : pastels (`p v b l y q`). Monde réel : tons nuit (`z Z j J 1 2 3 4 5 d G`). Horreur : `i K u R`.
- Les tuiles doivent **se répéter sans couture** et avoir 2–4 variantes pour casser la répétition.

---

## 2. Personnages — `src/data/sprites/characters.ts` (équipe ART-PERSO)

Exporte `CHARS: Record<string, CharDef>`, `ART` (portraits, PNJ statiques, poses), `VARIANTS`.

```ts
export const CHARS: Record<string, CharDef> = {
  noa: { down: [stand, step1, step2], up: [...], left: [...], variants: ['real', 'ink'] },
  // right = left en miroir (automatique) ; opts.colors permet des recolorations (moutons)
};
```

### 2.1 Personnages qui marchent (16×24, 3 frames par direction : debout, pas gauche, pas droit)

| id | Description | Variantes |
|---|---|---|
| `noa` | 14 ans. Cheveux indigo en bataille (`h/H`) qui cachent un peu les yeux, peau pâle, **grand sweat lavande** (`v/V/u`) aux cordons blancs, short marine (`n`), petites chaussures sombres. Air las. | `real`, `ink` |
| `mina` | 8 ans, plus petite (~20 px de haut dans le canevas 16×24). Couettes rousses (`m/M`), grands yeux, taches de rousseur, **couronne de papier dorée** (`y/Y`), **cape rouge** (`r/R`), robe blanche. Pétillante. | `ink` |
| `maman` | 16×28. Adulte fatiguée, cheveux châtains attachés, manteau beige, cernes. Tons sobres (monde réel). | — |
| `mouton` | 16×20 dans un canevas 16×24 (pieds en bas). Mouton debout, laine blanche bouffante (`w/W/g`), visage gris (`d`), oreilles et joues roses. | `ink` |
| `mouton_rose`, `mouton_bleu`, `mouton_jaune` | Même dessin que `mouton` avec `opts.colors` qui recolore la laine. | `ink` |

### 2.2 Portraits (32×32) — clés `face_<id>_<expression>`

| Personnage | Expressions requises |
|---|---|
| `noa` | `neutral`, `sad`, `surprised`, `tired` |
| `mina` | `neutral`, `happy`, `sad`, `surprised`, `angry`, `glitch` (visage déformé, yeux noirs, parasites) |
| `dodo` | `neutral`, `happy`, `creepy` (sourire trop large, yeux-boutons qui brillent) |
| `maman` | `neutral`, `sad`, `happy` |
| `chaussette` | `neutral`, `happy` |
| `lune` | `neutral` (Madame Lune endormie, bonnet de nuit) |

Portraits cadrés buste/visage, fond transparent, contour `k`. Ils sont affichés dans un carré sombre 36×36.

### 2.3 PNJ et poses statiques (ART)

| Clé | Taille | Description |
|---|---|---|
| `npc_dodo`, `npc_dodo_2` | 16×16 | Dodo flottant : mouton en peluche rond, laine blanche, visage gris clair, yeux-boutons noirs, petit nœud rose. `_2` = légère respiration. |
| `npc_dodo_dark`, `npc_dodo_dark_2` | 16×16 | Dodo corrompu : encre qui coule, yeux vides blancs, couture déchirée. |
| `npc_chaussette`, `npc_chaussette_2` | 16×24 | Marchande : chaussette-marionnette bleue à pois, yeux-boutons, petite bouche, nœud. |
| `npc_lune`, `npc_lune_2` | 32×32 | Madame Lune : croissant jaune endormi, bonnet de nuit bleu, « zzz ». |
| `npc_hibou`, `npc_hibou_2` | 16×20 | Hibou bibliothécaire en papier plié, lunettes rondes. |
| `npc_agneau` | 12×14 | Petit agneau (enfant du village). |
| `npc_placard` | 32×40 | Le Monstre du Placard apaisé : armoire sombre, yeux jaunes doux dans la fente, petits bras-cintres. |
| `npc_gomme` | 24×20 | Gomme apaisée : gomme rose usée, visage doux. |
| `npc_luciole`, `npc_luciole_2` | 8×8 | Luciole lumineuse (jaune/crème). |
| `pose_noa_lie` | 24×12 | Noa allongé au sol (face vers le haut). |
| `pose_noa_sit` | 16×20 | Noa assis, genoux repliés. |
| `pose_mina_cry` | 16×24 | Mina qui pleure, mains sur les yeux. |
| `pose_mina_glitch` | 16×24 | Mina déformée (lignes décalées, couleurs inversées partiellement). |
| `pose_hug` | 24×28 | Maman serrant Noa dans ses bras. |
| `pose_mina_light` | 16×24 | Silhouette de Mina faite de lumière (jaune pâle translucide, contour `y`). |

---

## 3. Tuiles — `src/data/sprites/tiles.ts` + `src/data/tiles.ts` (équipe ART-TUILES)

- Art : clés `t_<nom>` (+ variantes `t_grass_1`, `t_grass_2`…), `VARIANTS = ['ink']` (le chapitre 3 réutilise les
  tuiles du rêve en version encre).
- Registre : `src/data/tiles.ts` exporte `TILES` (garder `...DEV_TILES`). Chaque entrée est un `TileDef` :
  `{ art: string | string[], solid?, under?, over?, anim?, animSpeed?, edge? }`.
  - `art: [...]` = variantes choisies pseudo-aléatoirement par position.
  - `anim` = frames animées (eau). `under` = tuile dessinée dessous (fleur sur herbe).
  - `edge: { color, dark, group }` = la tuile déborde de 1–3 px irréguliers sur les voisines d'un autre type
    (herbe sur chemin, buisson sur herbe…). Utiliser pour l'herbe et les buissons.

**Identifiants de tuiles obligatoires** (les cartes ne peuvent utiliser que ceux-ci) :

| Monde | id | Solide | Description |
|---|---|---|---|
| Réel | `r_floor` | | parquet sombre (3 variantes) |
| Réel | `r_carpet` | | moquette de chambre bleu-gris |
| Réel | `r_tile` | | carrelage cuisine / salle de bain |
| Réel | `r_wall` | ✔ | face de mur haute (papier peint discret) |
| Réel | `r_wall_base` | ✔ | face de mur basse avec plinthe |
| Réel | `r_wall_top` | ✔ | dessus de mur (épaisseur, très sombre, liseré clair) |
| Réel | `r_void` | ✔ | noir hors carte |
| Réel | `r_window` | ✔ | fenêtre dans le mur haut : nuit + pluie (anim 2–3 frames) |
| Réel | `r_door_top` / `r_door` | ✔ | porte fermée (haut dans la rangée `r_wall`, bas dans `r_wall_base`) |
| Réel | `r_door_mina_top` / `r_door_mina` | ✔ | porte de Mina (pancarte « MINA », gommettes étoiles) |
| Réel | `r_door_open_top` / `r_door_open` | | embrasure sombre ouverte (on passe à travers) |
| Réel | `r_wall_mina` / `r_wall_mina_base` | ✔ | mur de la chambre de Mina (papier peint étoiles pastel, terni) |
| Réel | `r_floor_mina` | | moquette rose pâle |
| Rêve | `grass` | | herbe pastel (4 variantes, petites fleurs) — `edge` |
| Rêve | `grass_flowers` | | herbe très fleurie |
| Rêve | `path` | | chemin de sable-coton |
| Rêve | `cotton` | | sol de nuage de coton |
| Rêve | `water` | ✔ | eau pastel animée (3 frames, reflets) |
| Rêve | `bridge` | | planches au-dessus de l'eau |
| Rêve | `hedge` | ✔ | haie dense (bord de carte) — `edge` |
| Rêve | `cotton_wall` | ✔ | mur de nuages de coton |
| Rêve | `fence` | ✔ | barrière en bois sur herbe (`under: 'grass'`) |
| Rêve | `plank` | | plancher intérieur |
| Rêve | `rug` | | tapis tressé |
| Rêve | `wall_d` / `wall_d_top` | ✔ | mur intérieur pastel (face) / dessus |
| Rêve | `door_d_top` / `door_d` | ✔ | porte intérieure ronde |
| Rêve | `quilt_a`, `quilt_b` | | sol en courtepointe (Colline aux Couvertures) |
| Rêve | `pillow` | ✔ | gros coussin (obstacle) |
| Forêt | `paper` | | sol de papier ligné (3 variantes) |
| Forêt | `paper_scribble` | | papier avec gribouillis de crayon |
| Forêt | `crayon_grass` | | herbe dessinée au crayon de cire — `edge` |
| Forêt | `pencil_wall` | ✔ | forêt dense de crayons (bord de carte) |
| Forêt | `ink_water` | ✔ | mare d'encre bleue animée |
| Forêt | `erased` | | zone gommée : blanc vide aux contours fantômes (inquiétant) |
| Forêt | `desk_wood` | | sol de l'atelier (bois de bureau) |
| Hôpital | `h_floor` | | lino vert-gris pâle (variantes) |
| Hôpital | `h_wall` / `h_wall_base` / `h_wall_top` | ✔ | murs d'hôpital |
| Hôpital | `h_door_top` / `h_door` | ✔ | porte à hublot |
| Hôpital | `h_door_304_top` / `h_door_304` | ✔ | porte avec plaque « 304 » |
| Hôpital | `h_window` | ✔ | fenêtre, rideaux verts, nuit |
| Encre | `ink_puddle` | | flaque d'encre noire luisante |
| Encre | `ink_wall` | ✔ | mur d'encre qui coule (anim) |
| Vide | `v_floor` | | noir avec étoiles violettes discrètes |
| Vide | `v_edge` | ✔ | bord du vide (plus sombre) |
| Vide | `v_white` | | sol blanc lumineux (fin) |

---

## 4. Props (objets) — `src/data/sprites/props.ts` (équipe ART-PROPS)

`ART` avec ces clés, `VARIANTS = ['real', 'ink']`. Taille = taille du sprite ; « empreinte » = zone de collision
conseillée en tuiles (largeur×hauteur, alignée en bas). Les objets muraux (« mur ») se posent sur les rangées de mur.

**Monde réel**

| Clé | Taille | Empreinte | Description |
|---|---|---|---|
| `prop_bed` | 16×32 | 1×2 | lit de Noa, couette lavande défaite |
| `prop_bed_sleeping` | 16×32 | 1×2 | même lit, Noa endormi (tête sur l'oreiller) |
| `prop_bed_mina` | 16×32 | 1×2 | lit de Mina, couette rose à étoiles, peluches |
| `prop_desk` | 32×24 | 2×1 | bureau avec lampe, cahiers, téléphone |
| `prop_chair` | 16×16 | 1×1 | chaise |
| `prop_closet` | 32×32 | 2×1 | armoire fermée |
| `prop_closet_open` | 32×32 | 2×1 | armoire entrouverte, noir à l'intérieur |
| `prop_veilleuse`, `prop_veilleuse_off` | 8×10 | — | veilleuse en forme de lune (allumée / éteinte) |
| `prop_nightstand` | 16×16 | 1×1 | table de chevet |
| `prop_dodo_plush`, `prop_dodo_plush_dark` | 12×12 | — | Dodo en peluche (normal / inquiétant) |
| `prop_shelf` | 32×32 | 2×1 | étagère, livres, cadre |
| `prop_photo` | 8×8 | — | cadre photo retourné |
| `prop_calendar` | 12×14 | mur | calendrier |
| `prop_poster` | 16×20 | mur | poster (espace, planètes) |
| `prop_trash` | 10×12 | — | corbeille |
| `prop_plant` | 12×20 | — | plante en pot (un peu fanée) |
| `prop_fridge` | 16×32 | 1×1 | frigo avec dessins et un mot aimanté |
| `prop_counter` | 32×24 | 2×1 | plan de travail |
| `prop_sink` | 16×24 | 1×1 | évier |
| `prop_stove` | 16×24 | 1×1 | gazinière |
| `prop_table` | 32×24 | 2×1 | table de cuisine |
| `prop_sofa` | 32×20 | 2×1 | canapé |
| `prop_tv`, `prop_tv_2` | 24×24 | 2×1 | télé allumée (neige), 2 frames |
| `prop_tv_off` | 24×24 | 2×1 | télé éteinte |
| `prop_lamp` | 12×28 | — | lampadaire |
| `prop_bathtub` | 32×20 | 2×1 | baignoire |
| `prop_toilet` | 12×16 | — | toilettes |
| `prop_washbasin` | 16×20 | 1×1 | lavabo |
| `prop_mirror` | 14×20 | mur | miroir |
| `prop_phone`, `prop_phone_2` | 8×10 | — | téléphone posé, notification qui clignote |
| `prop_shoes` | 16×8 | — | chaussures d'entrée |
| `prop_coat` | 14×28 | — | portemanteau avec manteau |
| `prop_drawings` | 24×16 | mur | dessins de Mina au crayon |
| `prop_toybox` | 16×14 | 1×1 | coffre à jouets |
| `prop_carnet` | 10×8 | — | le carnet de Mina (léger halo) |
| `prop_clock` | 12×12 | mur | horloge |
| `prop_picture` | 16×12 | mur | tableau encadré |

**Rêve — Pays de Coton**

| Clé | Taille | Empreinte | Description |
|---|---|---|---|
| `prop_tree` | 32×48 | 1×1 (tronc) | arbre barbe-à-papa (feuillage rose/lavande) |
| `prop_tree_b` | 32×48 | 1×1 | variante menthe |
| `prop_tree_small` | 16×24 | 1×1 | arbrisseau |
| `prop_bush` | 16×14 | 1×1 | buisson rond |
| `prop_flower_big` | 16×20 | 1×1 | fleur géante |
| `prop_rock` | 16×12 | 1×1 | rocher arrondi |
| `prop_mushroom` | 12×14 | — | champignon |
| `prop_sign` | 16×16 | 1×1 | panneau en bois |
| `prop_lamppost` | 12×32 | 1×1 | réverbère à lune (lumineux) |
| `prop_house` | 48×48 | 3×2 | chaumière des moutons, porte ronde au centre-bas |
| `prop_house_b` | 48×48 | 3×2 | autre chaumière (couleurs différentes) |
| `prop_shop` | 48×48 | 3×2 | boutique de Chaussette (enseigne chaussette) |
| `prop_well` | 24×24 | 2×1 | puits |
| `prop_bench` | 24×12 | 2×1 | banc |
| `prop_balloon_tree` | 32×48 | 1×1 | arbre avec un ballon rouge coincé |
| `prop_cloud_big` | 48×24 | 3×1 | gros nuage de coton posé au sol |
| `prop_closet_door` | 32×48 | 2×1 | armoire seule au sommet de la colline (entrée du boss) |
| `prop_star_fallen` | 24×16 | 2×1 | étoile tombée (lumineuse) |
| `prop_pillow_big` | 32×16 | 2×1 | gros oreiller |
| `prop_stall` | 32×32 | 2×1 | étal de marché |
| `prop_mailbox` | 10×16 | — | boîte aux lettres |
| `prop_savepoint`, `prop_savepoint_2` | 12×18 | 1×1 | **point de sauvegarde** : petite veilleuse-lune sur un piédestal, lumineuse (2 frames) |
| `prop_bed_dream` | 16×32 | 1×2 | lit au milieu de la prairie (Noa s'y réveille dans le rêve) |
| `prop_counter_shop` | 32×16 | 2×1 | comptoir de boutique |
| `prop_jar_shelf` | 32×24 | 2×1 | étagère à bocaux |

**Forêt de Crayons**

| Clé | Taille | Empreinte | Description |
|---|---|---|---|
| `prop_pencil_r` / `_b` / `_y` / `_g` / `_v` | 16×48 | 1×1 | crayon géant planté pointe en haut (rouge, bleu, jaune, vert, violet) |
| `prop_lantern_{r,b,y,g}_off` / `_on` | 12×20 | 1×1 | lanterne en papier colorée (énigme) |
| `prop_crayon_rock` | 16×12 | 1×1 | bout de crayon de cire |
| `prop_paper_house` | 48×48 | 3×2 | bibliothèque du Hibou en papier plié |
| `prop_bookstack` | 16×20 | 1×1 | pile de livres |
| `prop_sharpener_big` | 24×20 | 2×1 | taille-crayon géant (décor) |
| `prop_eraser_crumbs` | 16×8 | — | miettes de gomme |
| `prop_easel` | 16×28 | 1×1 | chevalet |
| `prop_desk_big` | 48×24 | 3×1 | grand bureau à dessin |
| `prop_drawing_erased` | 24×20 | — | dessin à moitié gommé au sol |

**Hôpital de Papier**

| Clé | Taille | Empreinte | Description |
|---|---|---|---|
| `prop_h_bed` | 16×32 | 1×2 | lit d'hôpital (vide) |
| `prop_h_chair` | 14×16 | 1×1 | chaise de visiteur |
| `prop_h_iv` | 10×28 | — | pied à perfusion |
| `prop_h_monitor`, `prop_h_monitor_2` | 16×20 | — | moniteur cardiaque (ligne qui bat) |
| `prop_h_desk` | 32×24 | 2×1 | accueil |
| `prop_h_plant` | 12×20 | — | plante |
| `prop_h_wheelchair` | 16×16 | 1×1 | fauteuil roulant |
| `prop_h_drawings` | 24×16 | mur | dessins de Mina scotchés |
| `prop_h_nightlight` | 8×8 | — | veilleuse débranchée (cordon pendant) |
| `prop_h_table` | 16×16 | 1×1 | table de chevet |
| `prop_h_bench` | 32×12 | 2×1 | banc de salle d'attente |

**Vide / Fin**

| Clé | Taille | Description |
|---|---|---|
| `prop_door_light` | 16×32 | porte lumineuse dans le vide |
| `prop_dodo_giant` | 48×48 | Dodo immense (sur la carte, avant le combat final) |

---

## 5. Ennemis — `src/data/sprites/enemies.ts` + `src/data/enemies.ts` (équipe ENNEMIS)

Sprites : `b_<id>` et `b_<id>_2` (combat, ~32–64 px, contour `k` conseillé), `ow_<id>` et `ow_<id>_2`
(sur la carte, ~16×16). Plus `b_sheep` (12×10) et `b_sheep_big` (16×14) : moutons-projectiles de Dodo.
`b_dodo_dark` / `b_dodo_dark_2` : phase 2 de Dodo. Registre `ENEMIES` (garder `...DEV_ENEMIES`).

| id | Émotion | Concept | Besoin (`needs`) | Motifs conseillés |
|---|---|---|---|---|
| `gribouille` | neutre | boule de gribouillis noirs, deux yeux ronds | 1 mot de n'importe quelle émotion → utiliser `[{ emotion: 'joie' }]`… voir note | `ink_drops`, `ink_wiggle` |
| `nuage` | tristesse | nuage gris-bleu triste qui pleut | `[{ emotion: 'tristesse', count: 3 }]`, déteste `joie` | `rain`, `rain_puddles` |
| `mouton_noir` | colère | mouton noir grognon, cornes rouges | `[{ emotion: 'colere' }, { emotion: 'joie', count: 2 }]`, déteste `tristesse` | `horns`, `horns_charge` |
| `pissenlit` | joie | pissenlit rieur | `[{ emotion: 'joie', count: 3 }]`, déteste `colere` | `seeds`, `seeds_wind` |
| `chaussette_perdue` (fém.) | tristesse | chaussette bleue à pois esseulée | `[{ emotion: 'tristesse', count: 3, word: 'paire' }]` + `specialWords: [{text:'paire', emotion:'joie'}]` | `yarn` |
| `placard` (boss) | peur | armoire aux yeux jaunes | `[{ emotion: 'joie', count: 4 }]` (+ objet Veilleuse de poche géré par le scénario) | `hangers`, `closet_doors` |
| `taille_crayon` | colère | taille-crayon aux dents de métal | `[{ emotion: 'tristesse', count: 3 }]`, déteste `colere` | `shavings` |
| `avion` | neutre | avion en papier farceur | `[{ emotion: 'joie', count: 2 }]` | `planes` |
| `luciole` (fém.) | tristesse | luciole éteinte | `[{ emotion: 'joie', count: 3 }]`, déteste `colere` | `sparks` |
| `gomme` (boss, fém.) | colère | gomme rose géante | `[{ emotion: 'tristesse', count: 2 }, { word: 'garder' }]`, `specialWords: [{text:'garder', emotion:'tristesse'}, {text:'souvenir', emotion:'tristesse'}]` | `eraser_sweep`, `eraser_shrink` |
| `bip` | peur | moniteur cardiaque vivant | `[{ emotion: 'tristesse', count: 3 }]` | `ecg` |
| `perfusion` (fém.) | tristesse | pied à perfusion à tête de poche | `[{ emotion: 'joie', count: 3 }]` | `drip` |
| `dodo` (boss final) | neutre | Dodo géant | scénarisé par le chapitre 3 (`needs: [{ emotion: 'joie', count: 6 }]` par défaut) | `sheep_count`, `lullaby`, `dodo_rings`, `dodo_storm` |

Note `gribouille` : c'est l'ennemi du tutoriel ; `needs: [{ emotion: 'joie' }]` et pas de `hates`, ou tout autre
besoin simple — le tutoriel guide le joueur.

Équilibrage (Noa : 20 PV, ATQ 4, DÉF 1 au départ ; +4 PV max toutes les 4 Étoiles) :
chapitre 1 → PV 12–20, ATQ 0–2 ; boss 1 → PV 60, ATQ 2 ; chapitre 2 → PV 20–30, ATQ 2–3 ; boss 2 → PV 90, ATQ 3 ;
chapitre 3 → PV 30–40, ATQ 3–4 ; Dodo → PV 999 (ne peut pas être vaincu par la force).
Récompenses en Boutons : 3–8 (ch. 1), 6–12 (ch. 2), 10–15 (ch. 3), boss 20–40.

Textes (`EnemyDef`) : `check` (Observer), `flavor` (3–5 lignes « * … »), `flavorCalm`, `talk` (4–6 répliques de
bulle), `reactGood`/`reactBad`/`reactNeutral` (2–4 chacun), `reactSpecial` (mot → réplique), `spareText`, `killText`.
Ton : drôle et tendre au chapitre 1, mélancolique au 2, inquiétant au 3. Toujours en rapport avec le thème de
l'enfance, de la maladie et du deuil, avec délicatesse.

Motifs d'attaque disponibles (`src/game/battle/patterns.ts`) : `ink_drops`, `ink_wiggle`, `rain`, `rain_puddles`,
`horns`, `horns_charge`, `seeds`, `seeds_wind`, `yarn`, `hangers`, `closet_doors`, `shavings`, `planes`, `sparks`,
`eraser_sweep`, `eraser_shrink`, `ecg`, `drip`, `sheep_count`, `lullaby`, `dodo_rings`, `dodo_storm`, `calm`.

**Chapitre 4 — La Maison Cousue** (`src/data/enemies-ch4.ts`, sprites `src/data/sprites/enemies-ch4.ts`, motifs
`src/game/battle/patterns-ch4.ts`, fonds `feutre` / `stylo` / `noir`) :

| id | Émotion | Besoin | Motifs | Particularité |
|---|---|---|---|---|
| `pate_froide` (fém.) | tristesse | tristesse ×2, déteste joie | `noodle_rain`, `mold_spores` | nouilles blanches, pattes de fourchette |
| `mot_aimante` | colère | colère, puis joie ×2 | `magnet_letters`, `chatter_teeth` | lettres attirées par le cœur |
| `de_chevalier` | colère | tristesse ×3 | `pin_rain`, `pin_lance` | |
| `poupee_brouillon` (fém.) | peur | tristesse ×2, déteste joie | `scribble_box`, `chalk_lines` | inflige la peur ; la boîte se redessine |
| `cle` (fém.) | peur | tristesse, puis « ouvrir » | `tumblers`, `key_turn` | verrouille un bouton du menu par tour |
| `poupee_maman` (fém.) | neutre | tristesse puis « merci », ou « reste » | `slow_plates`, `four_plates` | ne tombe jamais ; drapeaux `c4_maman`, `c4_reste` |
| `couseuse` (boss, fém.) | colère → peur | tristesse ×2, puis « découdre » | `stitch_walls`, `needle_pin`, `stitch_cage` | coud les boutons du menu ; chaque mot écrit en découd un |
| `petit_homme` (boss) | colère → peur | peur, tristesse ×2, puis « rendre » | `doors_slam`, `noodle_rain`, `dark_noodles`, `dark_doors`, `dark_knocks` | phase 2 : arène noire, seul le cône de la veilleuse montre les projectiles |

Alliée : Mina n°366 (`G.state.party` contient `'mina366'`, chapitre 4), figée si `c4_couseuse === 'vaincue'`. Les
boss lui donnent une aide propre (hook `onAlly`). Moteur : `Bullet.draw` (`shape: 'custom'`, `data.hw/hh` = boîte de
collision, `data.pierce`), `BulletWorld.pre/post/dark/liveBox`, `soul.pin`, `Battle.backdrop`, `allySay`,
`prepareDodge`, `detune`.

---

## 6. Musique — `src/data/music.ts` (équipe AMBIANCE)

`TRACKS: Record<string, Track>`. Format (`src/engine/audio.ts`) :

```ts
title: {
  bpm: 66, stepsPerBeat: 2,  // croches
  vol: 0.8,
  channels: [
    { inst: 'musicbox', vol: 0.7, reverb: 0.5, pattern: 'E5 - - D5 C5 - | D5 - - E5 G5 - | ...' },
    { inst: 'pad', vol: 0.35, reverb: 0.6, pattern: 'C3+E3+G3 - - - - - | ...' },
  ],
},
```

Jetons : note (`C4`, `F#3`, `Bb2`), accord (`C4+E4+G4`), `.` silence, `-` tenir la note précédente, `x`/`X` coup
de batterie (instruments `kick`, `snare`, `hat`). `|` est ignoré (lisibilité). Chaque canal boucle sur sa propre
longueur. Instruments : `square`, `pulse25`, `pulse12`, `triangle`, `sine`, `saw`, `musicbox`, `piano`, `pad`,
`bass`, `pluck`, `bell`, `organ`, `kick`, `snare`, `hat`. Options de canal : `vol`, `transpose`, `reverb`, `pan`, `detune`.

**Leitmotiv — « La Berceuse de la Veilleuse »** (do majeur, 3/4, croches, 6 pas par mesure) — à décliner partout :

```
A : E5 - - D5 C5 - | D5 - - E5 G5 - | A5 - G5 E5 - - | D5 - - - - - |
    E5 - - D5 C5 - | D5 - - E5 C5 - | B4 - C5 D5 - G4 | C5 - - - - - |
B : A5 - - G5 E5 - | F5 - - E5 D5 - | G5 - - F5 D5 - | E5 - - - - - |
    A5 - - G5 E5 - | F5 - E5 D5 - C5 | D5 - - G4 B4 D5 | C5 - - - - - |
Accords : C G Am G | C G G7 C | F Dm G C | F Dm G C
```

| id | Ambiance |
|---|---|
| `title` | berceuse en boîte à musique + nappe, lente (≈66 bpm), réverbération |
| `room` | chambre la nuit : piano clairsemé, mélancolique, mi mineur |
| `room_quiet` | presque silence : quelques notes de boîte à musique très espacées (saisie du nom) |
| `interlude` | appartement en journée grise : piano + pad, triste, la mineur |
| `meadow` | prairie : chiptune joyeux et doux, leitmotiv en majeur, basse rebondissante (≈108 bpm) |
| `village` | village : tranquille, cosy, pizzicato (`pluck`), cloches (≈92 bpm) |
| `shop` | boutique : guilleret, léger swing (≈120 bpm) |
| `mina` | thème de Mina : espiègle et lumineux, pulse aiguë, leitmotiv transformé |
| `battle` | combat : énergique (≈140 bpm), lead carré, basse, batterie |
| `boss` | boss : intense, mineur, rapide (≈150 bpm) |
| `forest` | forêt : mystérieux, arpèges, flûte (`sine`), mode dorien |
| `hospital` | hôpital : glacé, bips, longues nappes désaccordées, très lent |
| `dodo` | thème de Dodo : la berceuse ralentie en mineur, boîte à musique désaccordée (`detune`) |
| `dodo_battle` | combat final : la berceuse déformée + rythme lourd, montée en tension |
| `void` | vide : drones, notes isolées, silence pesant |
| `ending` | fin : arrangement émouvant de la berceuse (piano + cordes/pad), lumineux |
| `gameover` | game over : courte phrase triste, boucle lente |

---

## 7. Illustrations — `src/data/illustrations.ts` (équipe AMBIANCE)

`ILLUSTRATIONS: Record<string, (g, t) => void>` : fonctions de dessin plein écran 320×180 (canvas 2D, `t` = frame
pour les petites animations). Style « dessin d'enfant aux crayons » pour les dessins de Mina (traits irréguliers,
hachures, couleurs vives sur papier), style pixel sombre pour les souvenirs réels. Toujours net (pixels entiers).

| Clé | Contenu |
|---|---|
| `souvenir_fenetre` | fenêtre d'hôpital la nuit, rideaux verts, pluie, une petite main posée contre la vitre |
| `souvenir_dessin` | dessin inachevé de Mina : deux enfants sous une grande lune, colorié à moitié |
| `souvenir_veilleuse` | une veilleuse-lune débranchée sur une table d'hôpital, cordon qui pend, nuit |
| `photo_famille` | photo de famille (Maman, Noa, Mina) un peu floue, cadre |
| `carnet_couverture` | couverture du carnet : « Le Pays de Coton — pour Noa », étoiles, gommettes |
| `carnet_page1` | dessin de la prairie avec Noa et Mina (couronne, cape) |
| `carnet_page2` | dessin du village des moutons et de Chaussette |
| `carnet_page3` | dessin de la forêt de crayons et du hibou |
| `carnet_page4` | dernière page : la lune, une veilleuse, et l'écriture « Si tu as peur du noir, regarde la lune. Moi je serai ta veilleuse. — Mina » |
| `fin_aube` | aube à la fenêtre de la chambre de Mina, silhouettes de Maman et Noa enlacés |
| `fin_beaux_reves` | Noa endormi dans son lit, Dodo veille, tout est bleu nuit, immobile |
| `fin_silence` | le Pays de Coton noyé d'encre, vide |
| `tv_mina` | image de vidéo familiale à la télé : Mina qui montre un dessin, lignes de balayage |

`SOUVENIRS` : `fenetre` (titre « La fenêtre », image `souvenir_fenetre`), `dessin` (« Le dessin inachevé »),
`veilleuse` (« La veilleuse »), `lumiere` (« La lumière sous la porte », chapitre 4), chacun avec 2–5 légendes
poignantes (`captions`).

v2 : une illustration par fichier de chapitre, autonome (ses propres petites primitives), ajoutée à `ILLUSTRATIONS`
par décomposition comme `illustrations-bonus.ts`. Chapitre 4 : `src/data/illustrations-ch4.ts` →
`souvenir_lumiere` (le couloir la nuit, le trait de lumière sous la porte, l'ombre d'une main posée à plat, le
radiateur). Toute nouvelle illustration va aussi dans `CATALOG` de `src/game/scenes/gallery.ts`.

---

## 8. Cartes et scénario (équipes RÉEL, CH1, CH2, CH3)

**Le déroulé scène par scène de toute l'histoire est dans `docs/SCENARIO.md` : c'est la référence narrative.**

### 8.1 Propriété

| Équipe | Cartes (`src/data/maps/…`) | Scénario (`src/game/story/…`) |
|---|---|---|
| RÉEL | `real.ts` → `REAL_MAPS` : `chambre`, `appartement`, `appartement_nuit`, `chambre_mina` | `real.ts` : `prologue`, `interlude1`, `interlude2`, `finale`, `DEBUG` |
| CH1 | `chapter1.ts` → `CHAPTER1_MAPS` : `prairie`, `village`, `boutique`, `maison_mouton`, `colline` | `chapter1.ts` : `start`, `DEBUG` |
| CH2 | `chapter2.ts` → `CHAPTER2_MAPS` : `lisiere`, `foret`, `clairiere`, `bibliotheque`, `atelier` | `chapter2.ts` : `start`, `DEBUG` |
| CH3 | `chapter3.ts` → `CHAPTER3_MAPS` : `ruines`, `hopital`, `chambre_304`, `vide` | `chapter3.ts` : `start`, `DEBUG` |

Les chapitres ne se connectent **que** via `src/game/story/common.ts` :
`enterDream(d, n)` (s'endormir → chapitre n), `wakeUp(d, n)` (se réveiller après le chapitre n),
`finishGame(d, 'aube' | 'beaux_reves' | 'silence')`. `STORY.dream[n]` = `chapterN.start` ; `STORY.wake[n]` =
`real.interlude1/2/finale`. Donc :

- `real.prologue` se termine par `await enterDream(d, 1)` ; `interlude1` par `enterDream(d, 2)` ; `interlude2` par
  `enterDream(d, 3)` ; `finale` (route de l'aube) par `finishGame(d, 'aube')`.
- `chapter1.start` / `chapter2.start` : charger la première carte (`d.load(map, spawn)`), jouer l'ouverture, rendre la
  main. La fin du chapitre (après le boss et le souvenir) appelle `await wakeUp(d, n)`.
- `chapter3` gère le combat final contre Dodo et ses trois issues : `wakeUp(d, 3)` (aube), `finishGame(d,
  'beaux_reves')`, `finishGame(d, 'silence')` (route du silence : `isSilenceRoute()` de `common.ts`).
- Un `start` de chapitre commence écran noir (`fx` à 1) : il doit faire `d.load(...)` puis `await d.fadeIn()`, et
  peut d'abord appeler `await d.chapter('Chapitre 1', 'Le Pays de Coton', 'sous-titre')`.

### 8.2 Format des cartes

```ts
export const CHAPTER1_MAPS: Record<string, MapDef> = {
  prairie: {
    id: 'prairie', name: 'Prairie de Coton', world: 'dream', music: 'meadow', particles: 'cotton', banner: true,
    tiles: `
      HHHHHHHHHHHH
      HggggggggggH
      Hgg..ggggggH
    `,
    legend: { H: 'hedge', g: 'grass', '.': 'path' },
    spawns: { default: { x: 3, y: 2, dir: 'down' } },
    props: [{ sprite: 'prop_tree', x: 5, y: 1, w: 1, h: 1, text: 'Un arbre en barbe à papa.' }],
    npcs: [{ id: 'agneau', sprite: 'npc_agneau', x: 8, y: 2, text: ['Bêê !'], who: 'mouton' }],
    enemies: [{ id: 'c1_nuage_1', enemies: ['nuage'], x: 9, y: 4, wander: 2 }],
    triggers: [{ x: 2, y: 2, w: 2, h: 1, once: 'c1_intro', script: introScript }],
    warps: [{ x: 11, y: 2, w: 1, h: 2, to: 'village', spawn: 'west' }],
  },
};
```

- Coordonnées en **tuiles** ; `x, y` d'un prop = coin haut-gauche de son **empreinte** (`w×h`, défaut 1×1) ; le
  sprite est centré horizontalement sur l'empreinte et posé sur son bord bas (`ox`/`oy` pour ajuster).
  `solid: false` pour les décors traversables, `under: true` pour les tapis, `over: true` pour ce qui passe devant.
- `world` : `'dream'` | `'real'` (variantes réelles + obscurité) | `'ink'` (tuiles et sprites corrompus) | `'void'`.
  Version 2 (`V2_WORLDS`, `src/engine/palette.ts`) : `'feutre'` (ch. 4, feutre chaud, contours cousus),
  `'stylo'` (nuits du ch. 4, stylo bille sur papier quadrillé), `'blanc'` (ch. 5, blanc sur blanc, trait bleu),
  `'ouate'` (ch. 6, coton jauni), `'faux'` (fausse aube, sursaturé). Les variantes `clé@monde` de chaque sprite et
  personnage sont construites à la demande (`?debug=map&map=village&world=feutre` pour essayer une carte existante).
- `darkness` (0–1) + `light` sur props/PNJ (`{ r, color, flicker }`) + `playerLight` pour l'éclairage.
- `ambience` : `'rain' | 'static' | 'wind' | 'hum' | 'none'` ; `particles` : `'fireflies' | 'cotton' | 'dust' |
  'rain' | 'ink' | 'petals' | 'stars' | 'snow'`.
- Murs vus de face : rangée `*_wall_top` (dessus), puis `*_wall` (haut de la face), puis `*_wall_base` (bas) ; le
  sol commence en dessous. Les portes : `door_top` dans la rangée `wall`, `door` dans la rangée `wall_base`, avec un
  `warp` `{ door: true }` sur la case `door` (on interagit face à la porte).
- Sorties de bord de carte : `warp` sans `door` (on marche dessus). Prévoir un spawn d'arrivée qui ne soit **pas**
  sur la zone de warp.
- Ennemis visibles : `enemies: [{ id: 'c1_xxx', enemies: ['nuage'], x, y, wander }]` (ids uniques dans tout le jeu,
  préfixés `c1_`, `c2_`, `c3_`). Ils disparaissent une fois épargnés ou vaincus.
- Points de sauvegarde (rêve) : `savePoint(x, y, texte?)` de `common.ts` dans `props`. Dans le monde réel, la
  veilleuse de la chambre peut servir de sauvegarde (`script: (d) => d.savePoint('…')`).
- Taille conseillée : 20–50 × 12–35 tuiles. Les petites pièces sont centrées automatiquement.
- Conditions : `cond: () => boolean` sur props/PNJ/triggers/warps/ennemis (helpers `f('flag')`, `nf('flag')`).

### 8.3 API de script (`Director`, voir `src/game/director.ts`)

```ts
await d.say('Texte', 'mina:happy');                // speaker:expression (voir src/data/speakers.ts)
await d.say(['Ligne 1', 'Ligne 2'], 'dodo');
const i = await d.ask('Question ?', ['Oui', 'Non'], 'mina');
await d.narrate('Il fait nuit.');                    // texte centré sans cadre (sur écran noir)
await d.wait(30);                                    // en frames (60 = 1 s)
await d.fadeOut(30); await d.fadeIn(30); d.flash('#fff'); d.shake(3, 20); d.glitch(30); d.bars(true);
d.music('meadow'); d.music(null); d.sfx('door'); d.ambience('rain');
await d.walk('player', 0, -2); await d.walkTo('mina', 10, 5, 0.8); d.face('mina', 'left'); await d.emote('mina', '!');
d.spawn({ id: 'dodo', sprite: 'npc_dodo', frames: ['npc_dodo','npc_dodo_2'], x: 5, y: 4, float: true });
d.remove('dodo'); d.show('dodo', false); d.follower('mina'); d.follower(null);
await d.cameraTo(10, 5); d.cameraFollow();
await d.warp('village', 'west'); d.load('prairie', 'arrive');   // load = sans fondu
d.flag('c1_x'); d.set('c1_x'); d.set('c1_count', 2); d.has('veilleuse_poche');
await d.give('lait'); d.take('ballon'); d.heal(); d.souvenir('fenetre'); d.save(); await d.savePoint();
const r = await d.battle(['placard'], { hooks, music: 'boss', bg: 'closet', intro: '* …' }); // r.outcome: 'win'|'spare'|'flee'|'lose'|'scripted'
await d.chapter('Chapitre 2', 'La Forêt de Crayons', '…'); await d.image('souvenir_dessin', ['légende…']);
await shop(['bonbon', 'lait', 'biscuit']);           // depuis common.ts
await d.paper(['ligne 1', 'ligne 2'], 'Titre');      // page de carnet manuscrite plein écran
await d.crash(['ERREUR : souvenir_mina introuvable', '…'], 180); // faux plantage (4ᵉ mur)
const mots = await d.poem('Pour Mina');              // poème à la DDLC → WordDef[] ; puis composePoem(mots) (scenes/poem.ts)
```

Effets visuels directs : `import { fx } from '../../engine/fx'` (`fx.glitch = 0.3`, `fx.gray`, `fx.tint`,
`fx.vignette`), `import { setPageTitle } from '../meta'` (titre d'onglet inquiétant), `G.state` / `G.meta` pour la
mémoire (`G.meta.newGames`, `G.meta.deaths`, `G.meta.endings`), `isLateNight()` de `src/game/meta.ts`.

**Combats de boss** : passer des `hooks` (`BattleHooks` de `src/game/battle/types.ts`) — `onMenu(b, i)` (intercepter
un bouton du menu principal, ex. « DORMIR »), `beforeTurn` (dialogues
entre les tours, `await b.bubble([{ e: b.enemies[0], text }])`, `await b.say('* …')`), `onItem` (ex. la Veilleuse
de poche pour le Placard), `onWord`, `words` (remplacer le carnet), `menuLabels` / `b.menuLabels` / `b.menuDisabled`,
`pattern`, `onDeath`, `onPlayerDeath`, `b.setEmotion`, `b.heal`, `b.end('scripted')`, `b.overlay`.

### 8.4 Texte : balisage et ton

- Balises : `{c:y}jaune{/c}` (couleurs `y r b p v g o l a`), `{wave}…{/wave}`, `{shake}…{/shake}`,
  `{glitch}…{/glitch}`, `{p:30}` (pause), `{spd:0.5}` (vitesse), `{player}` (nom du joueur), `{time}` (heure réelle).
- Version 2 : `{static}…{/static}` (friture : lettres qui sautent, bip remplacé par du grésillement) ;
  `{as:noa}` / `{as:noa:sad}` (à partir de là, la boîte appartient à un autre personnage : nom, portrait et bip
  changent au milieu de la boîte, T7) ; `{voice:noa}` (seul le bip change). `dialogue.narratorVoice` donne un bip au
  narrateur (`nightNarratorVoice(heure, G.meta.dodoSilent)` : le bip de Dodo entre minuit et 5 h).
- Une boîte = 3 lignes ≈ 42 caractères chacune (avec portrait) : couper les répliques longues en plusieurs boîtes.
- **Noa** parle très peu (phrases courtes, souvent « … »). **Mina** : énergique, imaginative, invente des titres
  (« Princesse-Chevalière »), tutoie tout le monde, fautes d'enfant mignonnes occasionnelles. **Dodo** : doux,
  rassurant, un peu trop ; s'adresse parfois au joueur (`{player}`) ; devient glaçant au chapitre 3.
  **Maman** : tendre, épuisée. Narration : sobre, poétique, au présent (« La veilleuse grésille. »).
- Les textes d'inspection d'objets commencent souvent par une description factuelle puis une pensée de Noa.
- Thèmes sensibles (deuil, maladie d'enfant) : jamais gratuit, jamais graphique. Le malaise vient du non-dit.

### 8.5 Drapeaux (flags)

Préfixes : `p_` (prologue), `i1_`, `i2_` (interludes), `c1_`, `c2_`, `c3_` (chapitres), `fin_` (finale).
Drapeaux partagés :

| Drapeau | Posé par | Lu par | Sens |
|---|---|---|---|
| `i1_ate` | RÉEL (interlude 1) | RÉEL (finale) | Noa a mangé quelque chose |
| `c1_placard_spared` | CH1 | CH3 / RÉEL | le Monstre du Placard a été apaisé |
| `c2_gomme_spared` | CH2 | CH3 / RÉEL | Gomme a été apaisée |
| `c1_chaussette_paire` | CH1 | CH2 | la Chaussette Perdue a retrouvé sa paire (Chaussette marchande heureuse) |
| `fin_route` | CH3 | RÉEL | `'aube'` quand Noa choisit de se réveiller |

**v2, chapitre 4** (`src/game/story/chapter4.ts`, cartes `src/data/maps/chapter4.ts`) : tous les drapeaux `c4_*`
sont documentés en tête du module. Lus par les lots suivants : `c4_maman` (`merci`|`reste`), `c4_reste`, `c4_coton`
(0–4, les Bourres du ch. 6), `c4_couseuse` (`epargnee`|`vaincue`), `c4_petit_homme` (`epargne`|`vaincu`), `c4_fele`
(veilleuse fêlée), `c4_mina366` (`merci`|`silence`), `c4_fin`. Couches : `maison_feutre` (monde `feutre`) et
`maison_stylo` (monde `stylo`, même plan, accessoires selon `c4_nuit` ∈ 1, 9, 22, 35, 42) ; l'horloge du salon
passe de l'une à l'autre. Aides de script : `look(lignes, répliqueMina?)`, `byNight({1: …, 22: …})`.
Mina n°366 suit Noa par `d.follower('mina366')` (ses répliques : `MINA_LINES`, `mina366Talk`).

### 8.6 Objets

Voir `src/data/items.ts` (`bonbon`, `lait`, `biscuit`, `chocolat`, `gateau`, `mouchoir`, `bulles`, `pluie`,
`orage`, `pomme` ; clés : `veilleuse_poche`, `ballon`, `chaussette_bleue`, `cle_mina`, `crayons`, `crayon_jaune`,
`dessin`). Équipements : `G.state.weapon` (`crayon` → `cire` → `plume`) et `G.state.armor` (`pyjama` → `plaid` →
`cape`) à donner par le scénario (ch1 : `cire`, ch2 : `plaid`, ch3 : `cape` / `plume`).

### 8.7 Musiques et ambiances par lieu

`chambre`/`appartement` → `room`/`interlude` + `rain` ; `prairie` → `meadow` ; `village` → `village` ;
`boutique` → `shop` ; `colline` → `mina` ; boss → `boss` ; `lisiere`/`foret`/`clairiere` → `forest` ;
`bibliotheque` → `village` (calme) ; `atelier` → `boss` pendant le combat ; `ruines` → `dodo` ; `hopital` /
`chambre_304` → `hospital` + `hum` ; `vide` → `void` puis `dodo_battle` ; finale → `ending`.
