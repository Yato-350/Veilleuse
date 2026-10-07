# Changelog

Toutes les évolutions notables du projet. Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).

## [1.0.0] — 2026-10

### Ajouté
- Moteur maison TypeScript : rendu pixel 320×180 à l'échelle entière, police bitmap avec accents, sprites en texte,
  synthé audio procédural, effets plein écran, entrées clavier / manette / tactile.
- Système de combat original **Plume & Cœur** : écrire des mots change la couleur du cœur ; les projectiles de la
  même couleur traversent l'âme.
- Histoire complète : prologue, trois chapitres oniriques, deux interludes réels, final, trois fins.
- Méta-narration : nom du joueur, mémoire persistante entre les parties, écran titre qui évolue.
- PWA installable sur mobile et jouable hors-ligne ; déploiement GitHub Pages ; CI complète.
- Application Android (APK) construite par GitHub Actions avec Capacitor.
- Bot de test (`tools/play.mjs`) qui rejoue les scènes, les combats et les fins dans un navigateur sans écran.

### Corrigé
- Première visite : la page ne se recharge plus quand le service worker prend la main (le joueur revenait à
  l'écran titre en pleine partie).
- Le compagnon ne réapparaît plus derrière un meuble après une cinématique.
