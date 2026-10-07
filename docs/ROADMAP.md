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
- 🚧 Équilibrage fin (le chapitre 3 est trop facile avec beaucoup d'Étoiles), relecture des dialogues par des joueurs
- ⏳ Scénarios du bot enregistrés et rejoués automatiquement en CI

## Phase 4 — Mobile natif 🚧
- ✅ Empaquetage Capacitor (Android APK) via GitHub Actions
- ✅ Publication des APK dans les Releases GitHub (tags `v*`)
- ⏳ Version iOS native (nécessite macOS et un compte développeur Apple — la PWA couvre iPhone/iPad)
- ⏳ Retour haptique avancé, plein écran natif

## Phase 5 — Après la sortie ⏳
- ⏳ Traduction anglaise (architecture i18n)
- ⏳ Chapitre bonus « Les rêves des autres »
- ⏳ Galerie des souvenirs, mode « Nouvelle partie + »
- ⏳ Succès (achievements) locaux
