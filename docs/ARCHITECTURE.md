# Architecture technique

*Veilleuse* est un jeu HTML5 écrit en **TypeScript strict**, sans moteur tiers ni fichier binaire : sprites, police,
musique et effets sonores sont générés par le code au démarrage. Le build Vite produit un site statique (≈ quelques
centaines de Ko) déployé sur GitHub Pages et installable comme application (PWA, hors-ligne).

```
index.html ─ main.ts ─┬─ engine/   (indépendant du jeu)
                      ├─ game/     (logique du jeu)
                      └─ data/     (contenu déclaratif)
```

## `src/engine` — moteur générique

| Module | Rôle |
|---|---|
| `game.ts` | Boucle à **pas fixe 60 Hz** (accumulateur), pile de scènes, ordonnanceur de promesses (`wait`, `until`) utilisé par les scripts |
| `screen.ts` | Mise à l'échelle **entière** du canevas 320×180 (pixels nets), disposition Game Boy en portrait, contrôles tactiles (croix 8 directions, A/B/Menu), vibrations |
| `input.ts` | Entrées unifiées clavier (codes physiques : WASD = ZQSD), manette (API Gamepad), tactile, glisser pour l'âme en combat, tapotement |
| `sprite.ts` | Sprites décrits en texte → canevas ; contour automatique, miroir, silhouettes, variantes de couleur |
| `palette.ts` | Palette globale, couleurs des émotions, transformations « monde réel » et « encre » |
| `font.ts`, `font-data.ts` | Police bitmap 5×7 proportionnelle avec composition des accents français, atlas par couleur |
| `audio.ts` | Synthé Web Audio : séquenceur façon *tracker* (planification anticipée), instruments (boîte à musique, piano, nappe, chiptune, batterie), réverbération à convolution, effets sonores et ambiances procédurales, « voix » de dialogue |
| `fx.ts` | Effets plein écran : fondus, flashs, secousses, glitch (aberration chromatique + déchirures), vignette, grain, bandes cinéma |
| `storage.ts` | `localStorage` robuste (mode privé, quota) avec repli en mémoire |
| `math.ts` | PRNG déterministe, hachage spatial, collisions, interpolations |

## `src/game` — le jeu

| Module | Rôle |
|---|---|
| `state.ts` | État de partie (`GameState`), mémoire méta persistante (`Meta`), paramètres, statistiques dérivées |
| `assets.ts` | Construction de tous les sprites au démarrage, personnages animés, variantes par monde |
| `director.ts` | **API de script** asynchrone (`await d.say(…)`, `d.walk`, `d.battle`, `d.warp`…) ; `runScript` verrouille le contrôle pendant les cinématiques |
| `overworld/` | Scène d'exploration : tilemap pré-rendue avec bordures organiques, entités triées en Y, collisions avec glissement aux coins, suiveur, ennemis visibles, déclencheurs, portes, caméra, éclairage dynamique, particules |
| `battle/` | Système **Plume & Cœur** : règles (triangle des émotions, résonance), ennemis et besoins émotionnels, monde de projectiles, bibliothèque de motifs, scène de combat écrite en `async/await` |
| `ui/` | Boîte de dialogue (machine à écrire, texte enrichi, portraits, choix), dessins d'interface, options |
| `scenes/` | Avertissement, titre (qui évolue selon les fins vues), saisie du nom, menu pause, boutique, game over, cartes de chapitre, illustrations, poème, crédits |
| `story/` | Scénario : `common.ts` relie les modules (`enterDream`, `wakeUp`, `finishGame`), un module par fil narratif |
| `meta.ts` | Quatrième mur : changement de titre d'onglet, retour sur la page, heure réelle |
| `pwa.ts` | Service worker, invite d'installation, notification de mise à jour |
| `debug.ts` | Points d'entrée de développement par URL (`?debug=map&map=…`, `?debug=battle&…`, planches de sprites) |

## `src/data` — contenu

Déclaratif et validé par `tests/content.test.ts` : sprites (`sprites/*.ts`), tuiles, cartes (`maps/*.ts`),
ennemis, objets, mots du carnet, musiques, illustrations, interlocuteurs. Voir `docs/CONTENT_CONTRACT.md`.

## `src/i18n` — traduction

Le français est la langue source : les textes restent en français dans le code et sont traduits à l'affichage
(`tr`, `tf`, `tn`) par recherche exacte dans un catalogue anglais (`src/i18n/en/`). Voir `docs/I18N.md`.

## Flux d'une partie

```
WarningScene → TitleScene → NameEntryScene → flow.newGame
  → story.real.prologue (WorldScene) → enterDream(1) → chapter1 → wakeUp(1) → interlude1 → enterDream(2) …
  → chapter3 → Dodo → { wakeUp(3) → finale | beaux_reves | silence } → finishGame → CreditsScene → TitleScene
```

## Qualité

- `npm run check` : ESLint, `tsc --noEmit` (mode strict), Vitest (moteur + validation de tout le contenu), build.
- `npm run test:e2e` : Playwright (bureau + mobile) — démarrage, nouvelle partie, chargement de toutes les cartes,
  tour de combat, sans erreur console.
- `node tools/shot.mjs` : captures d'écran scriptées pour la revue visuelle.
- CI GitHub Actions sur chaque push ; déploiement Pages automatique depuis `main`.
- Service worker généré au build avec la liste exacte des fichiers et un hash de version (`tools/vite-sw-plugin.ts`).
