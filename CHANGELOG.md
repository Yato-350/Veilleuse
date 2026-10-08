# Changelog

Toutes les évolutions notables du projet. Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).

## [1.1.0] — 2026-10

### Ajouté
- **Anglais** : tout le jeu est traduit (histoire, combats, objets, interface). « Langue / Language » dans les options,
  ou `?lang=en` dans l'adresse ; par défaut, la langue suit celle du navigateur.
- **Chapitre bonus « Les rêves des autres »** : le rêve de Maman, jouable après la fin de l'aube, avec son boss, Le Réveil.
- **Épilogue jouable** de la bonne fin : choisir une veilleuse neuve au bazar, la poser dans le jardin, lire le poème.
- **Répondre à Maman** par téléphone, au prologue et dans les interludes ; ses messages et le final en tiennent compte.
- **Carnet de souvenirs** sur l'écran titre : illustrations vues, poèmes écrits, « Garder ce poème » en image (partage
  sur mobile).
- **Combat** :
  - **mots doux-amers** (cœur bicolore) ;
  - **Mina alliée** (bouclier, recoloriage, soin) puis sa place vide après son effacement ;
  - **musique qui suit l'émotion** ;
  - **formes des émotions** pour les daltoniens (option) ;
  - **l'aide de Mina** après trois défaites (mode Histoire).
- **Combat final** : l'Encre noie une partie des mots de Mina ; les ennemis épargnés viennent aider contre Dodo.
- **Chapitre 1** : mini-jeu des moutons à compter sur la Colline, nouvelles scènes et répliques.
- **Tactile direct** : toucher les menus, le carnet, les listes, la boutique, les choix ; toucher un personnage, un
  objet ou une porte près de Noa.
- **Android** : APK signé avec une clé stable (secrets du dépôt) et fichier `.aab` pour le Play Store.

### Modifié
- Crédits : Yasin.

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
- Boutiques : la liste défile ; les derniers articles et « Partir » ne sont plus cachés sous la bulle.
- La réduction promise par Chaussette (paire retrouvée) s'applique vraiment : −50 %.
- Sauvegarde automatique quand l'application passe en arrière-plan ou se ferme (pendant l'exploration).
- Les objets ne sont plus perdus quand les poches sont pleines ; le bilan d'un combat ne déborde plus.
- Symboles manquants dans la police (●, ↖, ☰, effets de glitch) ; un test vérifie désormais toute la police.
