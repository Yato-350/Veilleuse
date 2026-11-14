# Changelog

Toutes les évolutions notables du projet. Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).

## [Non publié]

### Ajouté
- **Fichiers** (écran titre, après une première fin) : les fichiers des personnages, dans un vieil explorateur.
  `dodo.chr`, `mina.chr` et `maman.chr` peuvent être supprimés ; leurs répliques deviennent de la friture sous
  « ??? », sans portrait, et leur sprite se brouille, dans le monde et en combat. Toute l'histoire reste jouable.
  Dodo a son mot à dire tant que son fichier est là. La corbeille restaure ; `noa.chr` est en cours d'utilisation.

## [2.1.0] — 2026-11

Retours d'une partie entière (fin de l'aube, la veilleuse posée devant la tombe de Mina).

### Ajouté
- **Route de l'encre** : quand Noa tue presque tout le monde, les habitants du rêve reculent la première fois qu'il
  leur parle (« Ne me fais pas de mal. », « Monstre. »…) ; une flaque d'encre reste là où il a tué, et d'autres
  taches s'ajoutent le long des chemins.
- **Chaussette** apprend ce qui est arrivé à sa paire (un fil bleu à pois sur la manche de Noa) : « Monstre. ». Elle
  reste froide jusqu'au chapitre 6.
- **Fin Silence** : Dodo dit combien Noa en a tué, en toutes lettres.
- **Téléphone** : une corbeille pour effacer une conversation (ou le bouton menu)… et Dodo la remet, en parlant au
  joueur.

### Modifié
- **Boss** : 50 % de points de vie en plus et des attaques plus serrées, hors mode Histoire.
- L'évier fait « Plic. Plac. Ploc. ».
- Générique : « Canada et États-Unis : 988 ».

### Corrigé
- **Chapitre 5** : Noa ne disparaît plus dans la porte de verre ouverte de la chambre 304.
- **Carnet de combat** : le mot qu'on écrit n'est plus « en gras » (il était doublé par une ombre, illisible sur
  la page).

## [2.0.1] — 2026-11

### Corrigé
- **Sauvegarde** : après une sauvegarde faite juste au-dessus d'un personnage (en parlant à Dodo par le haut au
  chapitre 4, ou par la sauvegarde automatique quand on quitte l'application), « Continuer » remettait Noa dans le
  personnage, sans pouvoir faire un pas. Noa revient maintenant sur la case libre la plus proche, celle d'où il venait ;
  les sauvegardes déjà coincées repartent aussi.

## [2.0.0] — 2026-11

La deuxième version de l'histoire, « Il fait toujours nuit » : plus sombre, plus psychologique, toujours tendre. Le
jeu passe de 60–90 minutes à 3 h 30 – 4 h 30.

### Ajouté
- **Une histoire réécrite** : celle de la 1.1 reste entière, puis se retourne. De l'horreur psychologique (une
  narration qui ment, des boucles, des poupées cousues, de l'encre qui coule comme du sang, des choix qui font mal),
  toujours portée par les jouets, le papier et les créatures du rêve ; l'humour et la tendresse restent. Trois actes,
  chacun avec sa matière : les crayons de couleur, le stylo bille, puis le correcteur blanc et le coton.
- **Trois nouveaux chapitres** : 4 « La Maison Cousue », 5 « La Marée Blanche » et 6 « Le Ventre de Dodo », avec
  leurs cartes, leurs musiques et leurs énigmes (un dîner qui recommence, des coups à travers le mur, une partie de
  dessin à deux, une boîte à musique à réparer…).
- **Deux nouveaux interludes** dans le monde réel, en pleine nuit : III « Le sac » et IV « Le placard ».
- **La fausse aube**, un nouveau passage entre le chapitre 3 et l'Interlude III.
- **Neuf révélations**, préparées par des indices semés depuis le prologue : chacune fait relire une scène déjà vue.
- **Cinq fins** (deux nouvelles, dont une secrète) et une non-fin que le jeu n'enregistre jamais.
- **Combats** : dix-huit nouveaux ennemis, trois boss et un nouveau combat final en quatre phases. Des menus qu'on
  coud, un cœur épinglé, une arène noire où seule une lumière protège, des mots volés dans le carnet, des couleurs
  qui mentent ; une nouvelle alliée au chapitre 4.
- **Mémoire et nouvelle partie+** : le jeu se souvient de tes parties (les fins vues, tes choix, tes défaites) et la
  suivante n'est plus tout à fait la même ; il réagit davantage à l'heure réelle et à tes absences. L'écran titre
  change selon la dernière fin.
- **Téléphone** : plusieurs contacts, un fil épinglé, un journal d'appels et un an de messages à remonter.
- **Avertissement de contenu** réécrit au démarrage, et **carte d'aide** (3114, gratuit, 24 h/24) après les fins les
  plus sombres.
- **Anglais** : tout le nouveau contenu est traduit (histoire, combats, objets, illustrations, interface), et chaque
  fin a été rejouée en anglais jusqu'au générique.
- **Accessibilité** :
  - **« Réduire les attentes »** (nouvelle option) : les attentes en temps réel sont ramenées à quelques secondes ;
  - **« Réduire les flashs »** couvre aussi les glitchs et tous les nouveaux effets (fissures, éclats de verre, arène
    noire du combat final) ;
  - le **mode Histoire** s'applique aux nouvelles scènes où l'on compte (les coups, la boîte à musique) : sans pièges,
    plus lentes ; comme les moutons, la boîte à musique se laisse passer après deux échecs ;
  - avec les **formes des émotions**, le « ? » reste lisible quand les couleurs mentent.
- **Sauvegardes 1.1** : une partie 1.1 en cours se charge et continue dans la nouvelle histoire ; les fins déjà vues
  restent dans la mémoire du jeu.
- **Bot de test** : 192 scénarios rejouables (`tools/scenarios/`, `node tools/run-scenarios.mjs`) — chaque chapitre,
  chaque fin, la non-fin, la nouvelle partie+, les sauvegardes 1.1, l'anglais, l'accessibilité et une partie entière
  du titre au générique ; la CI en rejoue une sélection après les tests de bout en bout. Liste de contrôle des indices
  dans `docs/INDICES.md`.

### Modifié
- Le prologue, les chapitres 1 à 3 et les interludes I et II sont retouchés : nouveaux détails, nouvelles répliques,
  un nouvel ennemi au chapitre 3 (Bracelet), un combat plus court à la fin du chapitre 3.
- Le final « Le carnet » est réécrit ; l'épilogue et le chapitre bonus « Les rêves des autres » sont retouchés.

### Corrigé
- Le chapitre bonus n'écrase plus la sauvegarde de la partie principale quand l'application passe en arrière-plan.
- Le numéro de version en bas de l'écran titre et du générique s'affiche en entier (« v1.1.0 » se lisait « v110 »).

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
