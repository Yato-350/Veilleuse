# VEILLEUSE — Document de conception (GDD)

> *« Fais de beaux rêves. »*

**Genre** : RPG narratif 2D pixel art · combats « esquive + mots » · méta-horreur douce
**Inspirations** : *Undertale* (combats d'esquive, miséricorde, choix moraux), *OMORI* (monde rêvé / monde réel, émotions, deuil),
*Doki Doki Literature Club* (façade mignonne, mots et poèmes, quatrième mur)
**Plateformes** : navigateur (GitHub Pages) → installable sur tous les mobiles (PWA Android / iOS) → APK natif (Capacitor, phase ultérieure)
**Langue** : français
**Durée visée v1.0** : 60 à 90 minutes, 3 fins

---

## 1. Pitch

Noa, 14 ans, ne sort plus de sa chambre depuis un an. Il fait toujours nuit. La petite **veilleuse** en forme de lune
grésille sur la table de chevet, et le mouton en peluche de sa petite sœur, **Dodo**, se met à parler :

> « Tu ne dors pas ? Viens. Je connais un endroit où personne n'est jamais triste. »

Sous le lit s'ouvre le **Pays de Coton**, un monde dessiné aux crayons de couleur où **Mina**, la petite sœur, est là — vivante,
joyeuse, couronne de papier sur la tête. Chaque nuit, Noa s'enfonce un peu plus loin dans le rêve. Chaque matin, l'appartement
est un peu plus sombre, et la porte de la chambre de Mina reste fermée à clé.

*Veilleuse* raconte le deuil, la culpabilité et la tentation de ne plus jamais se réveiller — avec tendresse.

### Les trois piliers

| Pilier | Ce que ressent le joueur | Comment |
|---|---|---|
| **Tendresse** | « Je veux protéger ces personnages. » | Monde coloré, humour, Mina attachante, apaiser plutôt que blesser |
| **Malaise** | « Quelque chose ne va pas. » | Monde réel qui s'assombrit, glitchs, Dodo qui en sait trop, quatrième mur |
| **Empathie active** | « Comprendre l'autre est ma meilleure arme. » | Système **Plume & Cœur** : écrire les bons mots protège réellement |

---

## 2. Histoire

### 2.1 Personnages

| Personnage | Rôle | Description |
|---|---|---|
| **Noa** | Protagoniste (14 ans) | Cheveux sombres qui cachent les yeux, sweat trop grand. Parle peu. A cessé d'aller voir sa sœur à l'hôpital quand elle allait mal : « Je ne voulais pas la voir comme ça. » |
| **Mina** | Petite sœur (8 ans) | Couettes rousses, couronne de papier, cape rouge, crayon-épée. Dans le rêve, c'est « la Princesse-Chevalière du Pays de Coton ». Elle dessinait ce monde à l'hôpital, *pour* Noa. |
| **Dodo** | Guide → antagoniste | Mouton en peluche de Mina, offert à Noa : « Il veillera sur toi. » Mignon, serviable… puis on comprend qu'il est la voix du sommeil sans fin. Il connaît le nom du **joueur**. |
| **Maman** | Monde réel | Travaille de nuit, laisse des mots sur le frigo. On ne la voit qu'à la toute fin. |
| **Chaussette** | Marchande | Une chaussette-marionnette qui tient boutique au village. Cherche sa paire. |
| **Madame Lune** | Sage du village | Une lune endormie qui ne parle qu'en bâillant. Connaît la vérité. |
| **Les Moutonniers** | Villageois | Petits moutons en coton, chacun avec une manie. |

### 2.2 La vérité (révélée progressivement)

1. Mina était malade. Les derniers mois, elle dessinait à l'hôpital un carnet : *Le Pays de Coton — pour Noa*.
2. Noa a arrêté de venir la voir. Trop peur. Le dernier soir, Mina a demandé qu'on lui apporte sa veilleuse. Noa ne l'a pas fait.
3. Mina est morte cette nuit-là. Le carnet est resté dans sa chambre, que Noa a fermée à clé.
4. Le Pays de Coton est l'esprit de Noa qui rejoue le carnet qu'il n'a jamais ouvert. La Mina du rêve est un souvenir.
5. **Dodo** est la partie de Noa qui veut dormir pour toujours pour rester avec elle. Il sait que tant que *toi*, joueur·se,
   continues à jouer, le rêve continue d'exister.

### 2.3 Structure

| # | Chapitre | Monde | Lieux | Boss | Souvenir obtenu |
|---|---|---|---|---|---|
| 0 | **Prologue — Il fait nuit** | Réel | Chambre de Noa | — | — |
| 1 | **Le Pays de Coton** | Rêve | Prairie, Village des Moutons, Colline aux Couvertures | Le Monstre du Placard | *La fenêtre de l'hôpital* |
| I | **Interlude — Le frigo** | Réel | Appartement | — | — |
| 2 | **La Forêt de Crayons** | Rêve | Forêt, Clairière des Lucioles, Atelier | Gomme | *Le dessin inachevé* |
| II | **Interlude — La porte** | Réel | Appartement (sombre) | — | — |
| 3 | **L'Hôpital de Papier** | Rêve corrompu | Couloir sans fin, Chambre 304 | Dodo | *La veilleuse* |
| 4 | **Final — Le carnet** | Réel | Chambre de Mina | (Choix) | — |

### 2.4 Fins

| Fin | Condition | Résumé |
|---|---|---|
| **Aube** (vraie fin) | Ouvrir le carnet de Mina + écrire l'adieu à Dodo | Noa ouvre les rideaux. Le matin. Il va réveiller Maman. Le titre change pour un écran à l'aube. |
| **Beaux rêves** | Accepter de rester avec Dodo | Noa s'endort pour toujours. Le titre n'affiche plus que « Continuer ». Dodo te dit bonne nuit. |
| **Silence** | Avoir « effacé » (vaincu par la force) tous les ennemis | Le Pays de Coton est vide. Mina ne reconnaît plus Noa. L'Encre a tout recouvert. |

---

## 3. Gameplay

### 3.1 Boucle principale

```
Nuit : explorer le rêve → rencontrer → combattre / apaiser → énigme → boss → souvenir
  ↓ (se réveiller)
Jour : explorer l'appartement réel (plus sombre à chaque fois) → indices → se recoucher
```

### 3.2 Exploration (style OMORI)

- Vue de dessus, déplacement libre (8 directions), tuiles de 16 px.
- Interaction avec objets / PNJ, portes, téléporteurs, déclencheurs de scènes.
- Mina suit Noa (file de personnages).
- **Veilleuses** = points de sauvegarde : elles soignent et enregistrent. (« La petite lumière te remplit de courage. »)
- Énigmes légères : allumer des lanternes dans l'ordre, retrouver des objets, labyrinthes de couvertures.

### 3.3 Combat : le système **Plume & Cœur** (original)

Un combat au tour par tour avec phase d'esquive en temps réel (à la *Undertale*), où **les mots que tu écris changent
la couleur de ton cœur** — et donc ce qui peut te blesser.

**Menu du joueur**

| Commande | Effet |
|---|---|
| **FRAPPER** | Barre de timing : appuie au bon moment. Dégâts × précision × émotion. Vaincre un ennemi = **Encre**. |
| **ÉCRIRE** | Ouvre le carnet : *Observer* l'ennemi, ou choisir **un mot** parmi six (mini-jeu inspiré des poèmes de DDLC). |
| **OBJET** | Utiliser un objet (soins, changement d'émotion…). |
| **ÉPARGNER** | Si le cœur de l'ennemi est apaisé (nom en jaune) → il part en paix = **Étoiles**. Permet aussi de *Fuir*. |

**Les émotions**

| Émotion | Couleur du cœur | Effet en esquive | Triangle |
|---|---|---|---|
| Neutre | Blanc | Standard | — |
| Joie | Jaune | Vitesse +25 %, coups critiques | bat la Colère |
| Tristesse | Bleu | Vitesse −20 %, dégâts subis −40 %, régénère 1 PV / tour | bat la Joie |
| Colère | Rouge | Dégâts infligés +50 %, dégâts subis +30 % | bat la Tristesse |
| Peur | Violet | Vision réduite, mots brouillés | (subie seulement) |

**Règle d'or — la résonance** : *un projectile de la même couleur que ton cœur te traverse sans te blesser.*
> « Tu ressens la même chose. Ça passe à travers toi. »

Les projectiles blancs blessent toujours. Écrire un mot triste à un Nuage Triste l'apaise **et** rend ton cœur bleu :
sa pluie bleue ne te touche plus. L'empathie protège, littéralement.

**Besoins des ennemis** : chaque ennemi a un ou plusieurs besoins émotionnels (parfois une séquence, parfois un mot spécial).
Écrire un mot qui répond au besoin remplit sa jauge d'apaisement ; un mot qu'il déteste l'agite (attaques plus fortes).

**Progression**

- **Étoiles** (apaiser) → augmentent les PV max.
- **Encre** (vaincre) → augmente l'attaque… et assombrit l'histoire.
- Monnaie : **Boutons** (pour la boutique de Chaussette).

### 3.4 Bestiaire v1.0

| Ennemi | Chapitre | Émotion | Besoin | Attaques |
|---|---|---|---|---|
| Gribouille | 1 | Neutre | n'importe quel mot | Boules d'encre lentes (tutoriel) |
| Nuage Triste | 1 | Tristesse | Tristesse (empathie) — déteste la Joie | Pluie bleue |
| Mouton Noir | 1 | Colère | Colère puis Joie | Charges de cornes rouges |
| Pissenlit | 1 | Joie | Joie — déteste la Colère | Graines jaunes en spirale |
| Chaussette Perdue | 1 | Tristesse | mot spécial « paire » | Pelotes rebondissantes |
| **Monstre du Placard** | Boss 1 | Peur → Tristesse | Joie + objet *Veilleuse de poche* | Cintres, portes qui claquent |
| Taille-Crayon | 2 | Colère | Tristesse | Copeaux rotatifs |
| Hibou de Papier | 2 | Neutre | Joie | Plumes en éventail |
| Luciole Éteinte | 2 | Tristesse | Joie | Étincelles bleues/jaunes |
| **Gomme** | Boss 2 | Colère → Tristesse | « garder », « souvenir » | Efface la boîte, efface tes mots |
| Bip | 3 | Peur | Tristesse | Lignes d'électrocardiogramme |
| Perfusion | 3 | Tristesse | Calme | Gouttes qui tombent en rythme |
| **Dodo** | Final | Toutes | Le poème d'adieu | Moutons qu'on compte, berceuse, glitchs du menu |

### 3.5 Méta / quatrième mur (style DDLC / Undertale)

- Le jeu demande **ton** nom, pas celui de Noa. Dodo s'adresse à toi.
- Mémoire persistante séparée de la sauvegarde : le jeu se souvient des nouvelles parties, des morts, des fins vues.
- L'heure réelle : jouer entre minuit et 5h déclenche des répliques (« Il est 3h12. Tu devrais dormir, toi aussi. »).
- Changer d'onglet : le titre de la page change (« Ne pars pas »), Dodo le remarque à ton retour.
- Glitchs maîtrisés : texte corrompu, faux plantage, boutons du menu effacés pendant le combat final, écran-titre qui évolue.

---

## 4. Direction artistique

- **Résolution interne 320×180**, mise à l'échelle entière (nets pixels sur 720p, 1080p, 1440p, 4K, mobiles).
- **Rêve** : pastels, contours prune foncé, textures « crayon », lucioles, coton qui tombe.
- **Réel** : palette désaturée bleu nuit, lumière limitée (veilleuse, écran de télé, lune à la fenêtre), grain.
- **Horreur** : encre noire qui coule, aberration chromatique, déchirures horizontales.
- Sprites 16×24 (personnages), 16×16 (tuiles), 32–64 px (ennemis), portraits 32×32.
- Police bitmap maison avec tous les accents français.

## 5. Direction sonore

- Synthèse 100 % procédurale (Web Audio) : aucun fichier audio, chargement instantané, hors-ligne.
- **Leitmotiv** : *La Berceuse de la Veilleuse* (boîte à musique, 3/4), décliné dans chaque morceau.
- Morceaux : titre, chambre, prairie, village, boutique, combat, boss, forêt, hôpital, Dodo, fin, game over.
- « Voix » des personnages façon *Undertale* (bips de texte à timbre unique).

## 6. Contrôles

| Action | Clavier | Manette | Tactile |
|---|---|---|---|
| Se déplacer | Flèches / ZQSD / WASD | Stick / croix | Croix virtuelle (ou glisser pendant l'esquive) |
| Valider / interagir | Z / Entrée / Espace | A | Bouton A |
| Annuler / courir | X / Échap / Maj | B | Bouton B |
| Menu | C / Tab | Start / Y | Bouton ☰ |

## 7. Accessibilité

Vitesse du texte, volumes séparés, désactivation des secousses et des flashs, filtre CRT optionnel, **mode Histoire**
(dégâts réduits de 75 %), taille et opacité des contrôles tactiles, avertissement de contenu au démarrage,
ressources d'aide (3114) dans les crédits.
