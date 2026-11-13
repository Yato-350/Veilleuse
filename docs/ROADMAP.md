# Feuille de route

Légende : ✅ fait · 🚧 en cours · ⏳ prévu

## Phase 0 — Fondations ✅
- ✅ Document de conception (histoire, personnages, systèmes, DA, son)
- ✅ Projet TypeScript + Vite, ESLint, Prettier, Vitest, Playwright
- ✅ CI GitHub Actions (lint, types, tests, build) + déploiement GitHub Pages
- ✅ PWA : manifeste, icônes, service worker hors-ligne, installation mobile

## Phase 1 — Moteur ✅
- ✅ Boucle à pas fixe 60 Hz, pile de scènes, rendu 320×180 à l'échelle entière
- ✅ Entrées unifiées : clavier, manette, tactile (croix virtuelle + boutons, mode Game Boy en portrait)
- ✅ Police bitmap avec accents, boîte de dialogue (machine à écrire, voix, effets de texte, choix, portraits)
- ✅ Sprites en texte → atlas, palette, variante « monde réel »
- ✅ Synthé Web Audio : séquenceur de musique, réverbération, effets sonores
- ✅ Cartes en texte, collisions, PNJ, portes, déclencheurs, suiveur, caméra, éclairage
- ✅ Moteur de scripts asynchrone (cinématiques)
- ✅ Sauvegarde, mémoire méta persistante, paramètres

## Phase 2 — Combat Plume & Cœur ✅
- ✅ Menus, barre de timing, carnet de mots, objets, épargner / fuir
- ✅ Émotions, triangle, résonance des projectiles
- ✅ Bibliothèque de motifs de projectiles, boîte animée, invincibilité, game over

## Phase 3 — Contenu v1.0 ✅
- ✅ Prologue + Chapitre 1 (Pays de Coton) + Interlude I
- ✅ Chapitre 2 (Forêt de Crayons) + Interlude II
- ✅ Chapitre 3 (Hôpital de Papier) + Final + 3 fins
- ✅ Bot de test (`tools/play.mjs`) avec lequel chaque scène clé, chaque boss et les trois fins ont été rejoués avant la sortie
- 🚧 Relecture des dialogues par des joueurs

## Phase 4 — Mobile natif 🚧
- ✅ Empaquetage Capacitor (Android APK) via GitHub Actions
- ✅ Publication des APK dans les Releases GitHub (tags `v*`)
- ⏳ Version iOS native (nécessite macOS et un compte développeur Apple — la PWA couvre iPhone/iPad)
- ✅ APK signé avec une clé stable + App Bundle (`.aab`) pour le Play Store
- ⏳ Publication sur le Google Play Store
- ⏳ Retour haptique avancé, plein écran natif

## Phase 5 — Version 1.1 ✅
- ✅ Traduction anglaise (architecture i18n, test de couverture)
- ✅ Chapitre bonus « Les rêves des autres » (le rêve de Maman)
- ✅ Épilogue jouable, réponses à Maman, Carnet de souvenirs, partage du poème
- ✅ Mots doux-amers, Mina alliée, musique selon l'émotion, formes des émotions, aide après trois défaites
- ✅ Encre proportionnelle et amis épargnés au combat final ; mini-jeu des moutons au chapitre 1
- ✅ Tactile direct sur tous les menus et dans le monde

## Phase 6 — Version 2.0 « Il fait toujours nuit » ✅
La deuxième version de l'histoire, plus sombre et psychologique (bible : [`docs/HISTOIRE.md`](HISTOIRE.md), plan de
production au § 7). Durée : 3 h 30 à 4 h 30.
- ✅ Socle (lot 0) : six chapitres de rêve, nouvelles matières de palette (feutre, stylo bille, correcteur, coton,
  « faux »), voix qui change au milieu d'une boîte, scène de comptage généralisée (moutons, coups, dents), téléphone
  (contacts, fil épinglé, journal d'appels, un an d'historique), générique scripté, variantes de l'écran titre,
  migration des sauvegardes 1.1
- ✅ Chapitre 4 « La Maison Cousue » (lot 1), Interludes III « Le sac » et IV « Le placard » (lot 2), chapitre 5
  « La Marée Blanche » et sa partie de dessin à deux (lot 3), chapitre 6 « Le Ventre de Dodo » et le combat final en
  quatre phases (lot 4)
- ✅ Chapitre 3 retouché (combat de Dodo raccourci) et fausse aube, avec la non-fin « Fin heureuse » (lot 5)
- ✅ Indices des neuf révélations dans le monde réel et les chapitres 1 à 3 (lots 6 à 8)
- ✅ Final « Le carnet » réécrit, épilogue retouché, cinq fins dont la fin secrète (lot 9) ; mémoire méta et
  nouvelle partie+ (lot 10) ; bonus « La nuit de Maman » retouché (lot 11)
- ✅ Avertissement de contenu réécrit, carte d'aide (3114) après les fins sombres ; option « Réduire les attentes »,
  « Réduire les flashs » étendu aux glitchs et aux nouveaux effets, mode Histoire sur les comptages
- ✅ Traduction anglaise de tout le nouveau contenu, relue jusqu'à chaque fin (lot 12)
- ✅ QA (lot 13) : 191 scénarios du bot et une partie entière du titre au générique (`v2_aube`), tous verts ;
  liste de contrôle des indices ([`docs/INDICES.md`](INDICES.md)) ; preuves d'accessibilité ; une sélection de
  scénarios rejouée en CI ; documentation et version 2.0.0

## Phase 7 — Ensuite ⏳
- ⏳ Équilibrage après la partie de l'auteur. Jusqu'ici, il n'est mesuré qu'avec le bot (combats de debug avec
  `&etoiles=N`). Les deux cas durs : La Couseuse et Le Petit Homme de la Maison (chapitre 4), avec les Étoiles du
  début du chapitre et le plaid au lieu de la cape de Mina. À surveiller aussi : la phase 4 du combat final ne doit pas
  devenir triviale avec beaucoup d'Étoiles.
- ✅ Publication de la version Android 2.0.0 (APK et `.aab`), signée avec la clé stable des secrets du dépôt (voir
  le README, « Clé de signature Android ») : les versions suivantes s'installeront par-dessus
- ⏳ Écoute de la musique : les onze morceaux v2 (maison, maison_nuit, couseuse, petit_homme, plage, sas, vitre,
  ventre, appel, dodo_v2, faux_generique) et les effets de musique tenue ou inversée n'ont été vérifiés que par
  `tools/music-check.mjs` (boucles et tessiture), pas encore écoutés
- ⏳ Mise en forme Prettier : une centaine de fichiers ne suivent pas `npm run format:check` ; laissé tel quel pour la
  2.0.0 (un reformatage à part, sans autre changement)
- 🚧 Relecture des dialogues par des joueurs (la v2 comprise)
- ⏳ Succès locaux
