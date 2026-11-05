# VEILLEUSE — Document de conception (GDD)

> *« Fais de beaux rêves. »*

**Genre** : RPG narratif 2D pixel art · combats « esquive + mots » · horreur psychologique, tendre
**Inspirations** : *Undertale* (combats d'esquive, miséricorde, choix moraux), *OMORI* (monde rêvé / monde réel, émotions, deuil),
*Doki Doki Literature Club* (façade mignonne, mots et poèmes, quatrième mur)
**Plateformes** : navigateur (GitHub Pages) · installable sur tous les mobiles (PWA Android / iOS) · APK Android (Capacitor)
**Langues** : français (langue source) et anglais
**Durée** : version 2.0, 3 h 30 à 4 h 30, cinq fins dont une secrète, une non-fin et un chapitre bonus (version 1.1 :
60 à 90 minutes, 3 fins)

> **Spoilers.** Ce document dit tout. La bible de la version 2, [`docs/HISTOIRE.md`](HISTOIRE.md), fait foi pour
> l'histoire (vérité, révélations, scènes, fins, limites de contenu) ; ce document en résume la conception.

---

## 1. Pitch

Noa, 14 ans, ne sort plus de sa chambre depuis un an. Il fait toujours nuit. La petite **veilleuse** en forme de lune
grésille sur la table de chevet, et le mouton en peluche, **Dodo**, se met à parler :

> « Tu ne dors pas ? Viens. Je connais un endroit où personne n'est jamais triste. »

Sous le lit s'ouvre le **Pays de Coton**, un monde dessiné aux crayons de couleur où **Mina**, la petite sœur, est là — vivante,
joyeuse, couronne de papier sur la tête. Chaque nuit, Noa s'enfonce un peu plus loin dans le rêve. Chaque matin, l'appartement
est un peu plus sombre, et la porte de la chambre de Mina reste fermée à clé.

La version 1.1 racontait un garçon qui n'était pas venu voir sa petite sœur mourante. **La version 2, « Il fait toujours
nuit », garde cette histoire intacte, puis la retourne** : la confession de la chambre 304 n'était que la version que
Noa supporte. Derrière, il y a une veilleuse allumée sur sa propre table de nuit, un rhume, une promesse, un appel de
quarante et une secondes à 3 h 14, une mère qui a vu la lumière sous la porte, et un mouton en peluche qui n'a jamais
dit qu'une seule phrase, enregistrée sur une pile qui meurt.

*Veilleuse* raconte le deuil, la culpabilité et la tentation de ne plus jamais se réveiller. La tendresse reste la
base (l'humour de Mina, les moutons, Chaussette) ; la v2 y ajoute de l'**horreur psychologique** — une narration qui
ment, des boucles, des poupées cousues, de l'encre qui coule comme du sang, des choix qui font mal — toujours portée
par les jouets, le papier et les créatures du rêve, **jamais par le corps de Mina**.

### Les quatre piliers

| Pilier | Ce que ressent le joueur | Comment |
|---|---|---|
| **Tendresse** | « Je veux protéger ces personnages. » | Monde coloré, humour, Mina attachante, apaiser plutôt que blesser ; une scène tendre ou drôle par chapitre, une respiration après chaque scène d'horreur |
| **Malaise** | « Quelque chose ne va pas. » | Monde réel qui s'assombrit, glitchs, Dodo qui en sait trop, quatrième mur ; en v2, un narrateur qui ment, des boucles, des poupées cousues |
| **Empathie active** | « Comprendre l'autre est ma meilleure arme. » | Système **Plume & Cœur** : écrire les bons mots protège réellement |
| **Relecture** (v2) | « Attends… ça voulait dire autre chose. » | Neuf révélations qui relisent chacune une scène déjà vue ; chaque détail inquiétant a un double ordinaire |

---

## 2. Histoire

### 2.1 Personnages

| Personnage | Rôle | Description |
|---|---|---|
| **Noa** | Protagoniste (13 ans cette nuit-là, 14 aujourd'hui) | Cheveux sombres qui cachent les yeux, sweat trop grand. Parle peu. Ne sort plus de sa chambre depuis un an. À tout le monde, il a dit : « Je ne voulais pas la voir comme ça. » En vérité, il avait gardé la veilleuse pour lui, il était allé à l'hôpital enrhumé, et il était réveillé à 3 h 14 et à 3 h 38. Il se croit coupable de tout. |
| **Mina** | Petite sœur (8 ans) | Couettes rousses, couronne de papier, cape rouge, crayon-épée : « la Princesse-Chevalière du Pays de Coton », le monde qu'elle dessinait à l'hôpital, *pour* Noa. Elle savait qu'elle ne guérirait pas, et que c'était lui qui avait peur du noir ; elle a fait promettre qu'on lui mente, pour le protéger. |
| **Dodo** | Guide → antagoniste | Le mouton en peluche **de Noa** (« DODO — à Noa » sur l'étiquette), prêté à Mina (« Il veillera sur toi »), revenu le dernier soir. Une boîte à musique avec un module vocal cousu dans le ventre : une seule phrase enregistrée, sur une pile qui meurt. Tout le reste, c'est Noa qui fait la voix. Il connaît le nom du **joueur** ; le jeu ne dit jamais comment. |
| **Maman** | Monde réel | Aide-soignante de nuit aux Glycines, « pour ne pas penser ». A dormi quarante et une nuits dans le fauteuil de la chambre 304. A menti (« elle va mieux »), a vu la lumière sous la porte de Noa et l'a laissé dormir, puis faire semblant de dormir ; elle a fait semblant aussi, un an. Ne parle plus à Noa que par les mots du frigo. |
| **Nadia** | Infirmière de nuit | A renvoyé Maman dormir, a composé le numéro de Noa à 3 h 14, a tenu la main de Mina à la fin. A aidé Mina à coudre le module vocal dans Dodo. |
| **La Petite au Bonnet** | Silhouette | Une fillette sans visage, en bonnet tricoté à oreilles de mouton, toujours un peu plus loin depuis le chapitre 1 : Mina telle qu'elle était à la fin, le visage que Noa a refusé de regarder. |
| **Mina n°366** | Compagne du chapitre 4 | La Mina de feutre aux yeux-boutons que Dodo a recousue cette nuit ; elle redit les répliques du chapitre 1 avec un temps de retard. |
| **L'inconnue** | Monde réel, par SMS | La personne à qui le numéro de Mina a été réattribué : « S'il vous plaît, arrêtez. », puis, plus tard, de la gentillesse. |
| **Chaussette** | Marchande | Une chaussette-marionnette qui tient boutique au village. Cherche sa paire. Rachète le Bouton doré, si on veut. |
| **Madame Lune** | Sage du village | Une lune endormie qui ne parle qu'en bâillant. Connaît la vérité (« Il y en a un qui fait semblant. »). |
| **Les Moutonniers** | Villageois | Petits moutons en coton, chacun avec une manie ; l'un se compte lui-même et en est à trois cent soixante-quatre. |

### 2.2 La vérité

Rien de ceci n'est raconté d'un bloc : le joueur le reconstruit (bible § 1).

1. **Avant.** Dodo et la veilleuse lune étaient à Noa ; il a donné la veilleuse à Mina quand elle a eu peur du noir à
   son tour, et inventé un code à travers le mur de leurs chambres : 1 coup « T'es là ? », 2 coups « Je suis là. »,
   3 coups « Bonne nuit. » (la moitié des coups venaient du radiateur).
2. **La maladie** (jamais nommée). Chambre 304 ; Maman y dort quarante et une nuits ; Noa, 13 ans, reste seul à la
   maison. Le soir où Mina part à l'hôpital, il reprend la veilleuse ; il lui prête Dodo. Semaine 5, il y va enrhumé
   et cache sa toux (« Le grand frère, il tousse ? Dehors, s'il te plaît. ») ; quelques jours plus tard, Mina fait une
   infection grave, qui « peut venir de partout ». Noa n'entend que le mot « infection ». Une dernière fois, au sas, elle
   pose la main sur la vitre ; il ne pose pas la sienne. Mina fait promettre à Maman : « Dis pas à Noa que je guéris
   pas. » Maman écrit « Elle va un peu mieux ❤ ». Avec Nadia, Mina coud dans Dodo un module vocal à deux pistes.
3. **La dernière nuit.** 19 h 40 : Mina confie Dodo à Maman pour Noa. 20 h 12 : « Elle réclame sa veilleuse 🙂 Tu peux
   me l'apporter ? » — « oui tt à l'heure ». 23 h 20 : Maman rentre, voit la lumière sous la porte de Noa, « Il dort.
   Enfin. », règle le réveil sur 5 h. **3 h 14** : l'appel « Mina 🐑 », **quarante et une secondes** ; Noa dit au moins
   une fois « Dors. ». 3 h 33 : « Venez. Maintenant. » Mina part ; Nadia lui tient la main, la porte est ouverte sur la
   lumière du couloir : **elle n'était pas dans le noir**. 3 h 38 : Maman débranche la veilleuse de Noa et voit ses
   paupières trembler. Personne ne parle jamais de cette nuit.
4. **L'année d'après.** Noa découpe son visage sur les photos de famille. Chaque soir, il appuie sur le ventre de Dodo ;
   quand la pile faiblit, il finit la phrase lui-même. Chaque soir, il écrit « bonne nuit » au numéro de Mina. Chaque
   nuit, il rêve le Pays de Coton : Dodo — lui-même — recoud une Mina à partir du carnet et l'arrête avant qu'elle
   finisse sa phrase. Trois cent soixante-quatre nuits. **La nuit 365, c'est la partie** : la seule chose nouvelle, c'est
   quelqu'un qui tient sa main, le joueur.

**Le thème** : tout le monde a fait semblant de dormir pour quelqu'un qu'il aimait. **L'antagoniste** n'est pas un
méchant, c'est le deuil qui se protège lui-même ; la logique de Dodo : « Tant que c'est ta faute, elle est encore un peu
là. » **La question** qui fera débat — « Qui a laissé Mina dans le noir ? » — admet plusieurs lectures (Noa, Maman,
Mina elle-même, personne) ; le jeu affirme les faits médicaux (c'est la maladie qui l'a emportée) et ne dit jamais ce
que Noa a dit pendant les quarante et une secondes.

**Règles d'écriture** (bible § 1.5) : la règle des 41 secondes (rien, nulle part, ne dit quelle version de l'appel est
la vraie) ; le corps de Mina n'est jamais montré malade, blessé ni mort ; chaque détail inquiétant a un double
ordinaire ; le narrateur ment jusqu'au chapitre 6 ; un contrepoint tendre obligatoire ; ne jamais expliquer comment
Dodo connaît le joueur.

### 2.3 Les révélations

| # | Nom | Où | Ce que le joueur comprend |
|---|---|---|---|
| T0 | *(la vérité v1.1)* | ch. 3, porte 304 | « Il n'est pas venu. Elle avait demandé sa veilleuse. » |
| T1 | La fausse aube | fin du ch. 3 | La fin était celle du rêve : le carnet de Mina s'arrête là, la suite est écrite au stylo par Noa. |
| T2 | Le mouton de Noa | Interlude III | Dodo était à Noa ; « Il veillera sur toi », c'étaient ses mots à lui. |
| T3 | Trois cent soixante-cinq | ch. 4, le grenier | Noa revient chaque nuit depuis un an ; Mina est recousue chaque soir, puis effacée ; le joueur est la seule chose nouvelle. |
| T4 | La lumière sous la porte | fin du ch. 4 | La veilleuse était allumée sur sa table de nuit : il l'avait reprise parce qu'il avait peur du noir. |
| T5 | Cinq heures | Interlude IV | Maman a vu la lumière et a choisi de le laisser dormir ; et elle cache autre chose (« MAMAN TU DIS PAS A NOA »). |
| T6 | Il est venu | ch. 5 | Il est venu, enrhumé ; il croit l'avoir contaminée ; « elle va mieux » était un mensonge demandé par Mina. |
| T7 | Dodo n'a jamais parlé | entrée du ch. 6 | Dodo n'a qu'une phrase, enregistrée ; tout le reste, et le narrateur aussi, c'est Noa qui fait la voix. |
| T8 | Quarante et une secondes | ch. 6, le couloir | Il était réveillé, au téléphone avec elle à 3 h 14 ; il a dit « Dors » ; à 3 h 38, il faisait semblant de dormir. |
| T9 | La Petite au Bonnet | ch. 6, avant le combat final | La fillette sans visage est Mina telle qu'elle était à la fin. |
| Coda | « Je savais » | Final | Maman savait qu'il ne dormait pas ; elle a vu l'appel ; elle a fait semblant aussi, pendant un an. |
| Secret | Le bouton doré | fin *Veilleuse* | La vraie voix de Mina : « C'est pas toi qui m'as rendue malade, gros bêta. », enregistrée *avant* l'appel. |

Chaque révélation relit une scène existante : les indices sont semés dès le prologue (liste de contrôle, avec
fichier:ligne et scénario de preuve : [`docs/INDICES.md`](INDICES.md)).

### 2.4 Structure : trois actes, six chapitres

| Acte | Segments | Matière | Ce que le joueur croit |
|---|---|---|---|
| **I. Le carnet de Mina** | Prologue → ch. 1 → I → ch. 2 → II → ch. 3 → fausse aube | crayons de couleur (le carnet dessiné par Mina) | « Il n'est pas venu. Il n'a pas apporté la veilleuse. » |
| **II. Les pages de Noa** | III → ch. 4 → IV | stylo bille noir sur papier quadrillé, feutre cousu | « Il l'a gardée pour lui. Et ce n'est pas la première nuit. » |
| **III. Dedans** | ch. 5 → ch. 6 → final → épilogue | correcteur blanc et stylo bleu, puis l'intérieur de la peluche | « Il était là. Il était réveillé. Personne ne saura ce qu'il a dit. » |

| # | Segment | Monde | Lieux | Boss | Souvenir | Durée |
|---|---|---|---|---|---|---|
| P | **Prologue — Il fait nuit** | Réel, 23 h 52 | Chambre de Noa | — | — | 5 min |
| 1 | **Le Pays de Coton** | Rêve (crayons) | Prairie, Village des Moutons, Colline aux Couvertures | Le Monstre du Placard | *La fenêtre* | 25 min |
| I | **Interlude — Le frigo** | Réel, jour gris | Appartement | — | — | 6 min |
| 2 | **La Forêt de Crayons** | Rêve (crayons) | Lisière, Forêt, Clairière des Lucioles, Bibliothèque, Atelier | Gomme | *Le dessin inachevé* | 25 min |
| II | **Interlude — La porte** | Réel, 3 h 33 | Appartement (sombre) | — | — | 6 min |
| 3 | **L'Hôpital de Papier** | Rêve (crayon et encre) | Ruines, couloir sans fin, Chambre 304 | Dodo (combat court) | *La veilleuse* | 25 min |
| FA | **La fausse aube** | « Réel » trop beau | Chambre, appartement | — (le faux générique) | — | 5 min |
| III | **Interlude — Le sac** | Réel, 4 h 06 | Chambre, couloir, placard de l'entrée | — | — | 8 min |
| 4 | **La Maison Cousue** | Rêve (feutre / stylo bille) | Maison de feutre, maison au stylo, grenier, couloir des coups | La Couseuse (mini-boss), Le Petit Homme de la Maison | *La lumière sous la porte* | 35–45 min |
| IV | **Interlude — Le placard** | Réel, 4 h 44 | Chambre, chambre de Maman | — | — | 8 min |
| 5 | **La Marée Blanche** | Rêve (trop clair, puis correcteur) | Plage, sas, lac blanc, chambre de verre | La Vitre | *La vitre* (ou *La vitre fendue*) | 30–35 min |
| 6 | **Le Ventre de Dodo** | Rêve (l'intérieur de la peluche) | Couture, ouate, boîte à musique, couloir des 41 portes, voix | Dodo (combat final) | — | 30–35 min |
| F | **Final — Le carnet** | Réel, 5 h 52 | Chambre de Noa, chambre de Mina | (choix) | — | 12 min |
| E | **Épilogue — Une veilleuse neuve** | Réel, le matin | Le Petit Bazar, le jardin | — | — | 8 min |
| B | **Bonus — La nuit de Maman** | Le rêve de Maman, 3 h 33 | Les Glycines, l'appartement, l'hôpital de papier | Le Réveil | — | 20 min |

Les chapitres 2 à 6 se passent pendant **la même nuit**, la plus longue : entre deux chapitres, Noa remonte à la surface
et l'horloge avance (3 h 33, 4 h 06, 4 h 44) ; du chapitre 5 au chapitre 6, il ne remonte pas, il tombe. Le détail des
scènes : [`docs/SCENARIO.md`](SCENARIO.md) et la bible, § 3.

### 2.5 Fins

| Fin | Condition | Ce qu'elle dit |
|---|---|---|
| **Aube** (vraie fin) | [Ouvrir les yeux] au ch. 6, hors route du Silence, moins de trois dessins corrigés au lac blanc (`c5_corrige` < 3) | Noa regarde, accepte de ne pas savoir, et choisit le matin. Dodo est muet ; Noa se lève quand même. Épilogue ; l'écran titre passe à l'aube. |
| **Aube blanche** | [Ouvrir les yeux], hors Silence, trois dessins corrigés ou plus | Il se réveille dans un mensonge qu'il a dessiné lui-même : le poème ajoute « j'étais là », Maman ment pour lui une deuxième fois, le soleil est un rond de correcteur. Un mensonge qui console est-il une fin heureuse ? |
| **Beaux rêves** | [Rester] au ch. 6 | Le repli, pas la mort : Dodo obéit à la lettre à « fais de beaux rêves » ; un garçon vivant dont les années passent derrière sa porte. Le titre n'offre plus que « Continuer » et compte les jours réels. |
| **Silence** | Route de l'Encre : n'avoir épargné personne et vaincu au moins huit ennemis (`isSilenceRoute()` ; les Gribouilles Noires ne comptent pas) | Il va mieux parce qu'il a tout effacé : le prénom de Mina devient « ______ », sa chambre un débarras. Oublier, est-ce guérir ? |
| **Veilleuse** (secrète) | Une *Aube* déjà vue ; le Bouton doré gardé ; « Non. J'ai de la fièvre. » au portail ; `c5_corrige` < 3 ; la Pile épargnée ; « Je ne sais pas » à la question de l'appel ; la pile du réveil prise (Interlude IV) | Noa découd Dodo : le dessin fini (« FINI. (sans toi mais avec toi) »), la piste 2 et la vraie voix de Mina. Elle lève la culpabilité que les faits peuvent lever (l'infection) et laisse les 41 secondes sans réponse. Dodo ne parle plus jamais, dans aucune partie. |
| *« Fin heureuse »* (non-fin) | [Laisser défiler] le faux générique de la fausse aube | Le happy end de Dodo (« Merci d'avoir joué ! — Dodo »), titre au point de croix ; jamais enregistrée, au plus trois tours. |

Une **carte d'aide** (3114, gratuit, 24 h/24) suit le générique de *Beaux rêves*, *Silence* et *Aube blanche*. Chaque fin
choisit l'écran titre suivant. Le chapitre bonus s'ouvre après l'une des trois aubes.

---

## 3. Gameplay

### 3.1 Boucle principale

```
Nuit : explorer le rêve → rencontrer → combattre / apaiser → énigme → boss → souvenir
  ↓ (se réveiller)
Réel : explorer l'appartement (plus sombre, puis plus tard dans la même nuit) → indices → se recoucher
```

En v2, les réveils de l'acte II se font en pleine nuit (4 h 06, 4 h 44) ; du chapitre 5 au chapitre 6, pas de réveil.

### 3.2 Exploration (style OMORI)

- Vue de dessus, déplacement libre (8 directions), tuiles de 16 px.
- Interaction avec objets / PNJ, portes, téléporteurs, déclencheurs de scènes.
- Mina suit Noa (file de personnages) ; au chapitre 4, c'est Mina n°366 ; aux chapitres 5 et 6, Mina n'est plus là.
- **Veilleuses** = points de sauvegarde : elles soignent et enregistrent. (« La petite lumière te remplit de courage. »)
  Au chapitre 4, dans la maison de feutre, c'est Dodo qui en sert.
- Énigmes légères : allumer des lanternes dans l'ordre, retrouver des objets, labyrinthes de couvertures.
- **Nouveautés de la 2.0** : le dîner qui recommence et les deux couches de la maison cousue (l'horloge à coucou), le
  couloir où l'on répond aux coups à travers le mur, les coquillages, la serviette (attendre trente secondes réelles),
  le sas où une porte ne s'ouvre que si l'on ferme celle de derrière, les dessins à corriger, la partie de **dessin à
  deux** (tenir A pour suivre le pointillé, la toux fait déraper le trait), les bocaux des nuits, la boîte à musique dont
  il faut remettre les dents, le couloir des 41 portes. La scène de comptage des moutons (1.1) sert aussi aux **coups**
  (Interlude IV, couloir, combat final) et aux **dents** (chapitre 6), avec un mode « répondre » (1, 2 ou 3 coups).
- **Téléphone** : plusieurs contacts, un fil épinglé qu'on ne peut pas ouvrir avant l'Interlude III, un journal
  d'appels, un an d'historique à remonter ; on répond à Maman (1.1) et, une fois, au fil « Mina 🐑 ».

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

**Nouveautés de la 1.1**

- **Mots doux-amers** (chapitres 2 et 3 : « berceuse », « photo », « goûter d'avant », « vieux dessin », « souvenir »,
  « dessin », « son rire », « anniversaire ») : un mot porte **deux émotions**, Joie + Tristesse. L'écrire rend le cœur
  **bicolore** (cœur fendu jaune/bleu, HUD « DOUX-AMER ») : les projectiles **des deux couleurs** le traversent ; le blanc
  et les autres couleurs blessent toujours. Règles :
  - le mot répond à un besoin de **l'une ou l'autre** émotion, pour +1 (pas +2) ;
  - si l'une des moitiés répond au besoin, le mot apaise **même si l'ennemi déteste l'autre** (la douceur porte
    l'amertume) ; sinon, une moitié détestée l'agite comme d'habitude ;
  - un cœur bicolore se bat comme un cœur **neutre** (pas de triangle, pas de critique de la Joie, pas de régénération
    de la Tristesse) et se déplace à la vitesse moyenne des deux : sa force, c'est la résonance, pas les dégâts.
- **Mina alliée** (chapitres 1–2, et chapitre 3 tant qu'elle n'est pas effacée — si elle est dans l'équipe) : son portrait
  en haut à gauche, avec trois pastilles qui se remplissent. **Tous les 3 tours**, avant l'attaque ennemie, elle agit avec
  une réplique : **pansement** (+25 % des PV max, au moins 4) si Noa est à la moitié de ses PV ou moins ; sinon, en
  alternance, un **bouclier de crayon** (absorbe 3 coups pendant l'esquive) ou elle **colorie le blanc** dans la couleur
  du cœur (les projectiles blancs de cette esquive résonnent ; seulement si le cœur est coloré). Jamais pendant le
  tutoriel, le combat final contre Dodo, ni dans le monde réel.
- **La place vide** : au chapitre 3, après l'effacement de Mina, le HUD garde son cadre vide (« … »). Au tour où elle
  aurait agi, une ligne note son absence (« * Tu attends le dessin de Mina. Il ne vient pas. ») — la première fois
  toujours, ensuite dans un combat sur trois environ, une seule fois par combat.
- **Mina aide après trois défaites** : à la 3ᵉ défaite d'affilée contre le même combat, si Mina combattait aux côtés de
  Noa, l'écran de game over la montre chasser le murmure de Dodo : « Tu veux que je t'aide un peu ? ». Accepter active le
  **Mode Histoire** (sauvegardé, réversible dans les Options) ; refuser est respecté (elle ne redemande pas pour cette
  série). Une victoire ou une fuite remet le compteur à zéro.
- **La musique suit le cœur** : la couleur du cœur façonne la piste du combat — Tristesse : étouffée et plus lente ;
  Joie : un peu plus vive ; Colère : plus rapide ; Peur : légèrement ondulante et voilée ; cœur bicolore : la moyenne des
  deux. Tout est remis à zéro à la fin du combat ; le combat final contre Dodo garde son propre traitement
  (implicite pour Dodo ; `BattleOptions.fixedMusic` pour tout autre combat dont les scripts pilotent la musique).
- **Formes des émotions** (option d'accessibilité, désactivée par défaut) : chaque émotion a une petite forme en plus de
  sa couleur — Joie = soleil, Tristesse = goutte, Colère = pointes, Peur = spirale, Neutre = anneau. Elles s'affichent
  au-dessus du cœur, dans les projectiles colorés (le blanc reste nu), devant les mots du carnet (deux formes pour un
  mot doux-amer) et à côté de l'émotion dans le HUD.

**Nouveautés de la 2.0**

- **Mots spéciaux** des nouveaux ennemis : « prénom », « ouvrir », « merci » / « reste », « découdre », « rendre »,
  « fièvre », « je ne sais pas », « regarder », « pardon », « garder ». Ils restent des identifiants français ; seul
  l'affichage est traduit.
- **Des combats qui touchent à l'interface** : des boutons du menu cousus un à un (écrire un mot les découd), une
  commande verrouillée par tour, un cœur épinglé une seconde, ou cousu (sa couleur reste deux tours), un mot volé dans le
  carnet à chaque tour, la boîte de dialogue qui rétrécit et étouffe le texte, une arène noire où seul le cône de la
  veilleuse protège, un chiffre qui monte jusqu'à 40, des moutons à épargner dans l'ordre de leurs numéros.
- **La Gribouille Noire** n'a pas de cœur : les mots glissent dessus, chaque coup la dédouble, on ne peut que fuir ; sa
  mort n'est jamais de l'Encre.
- **Mina n°366** (chapitre 4) remplace Mina alliée, en version cousue : un rond de feutre sur le cœur (pansement), un dé
  à coudre (bouclier), elle brode (le blanc colorié). Si La Couseuse est vaincue, elle se fige dans son cadre jusqu'à la
  fin du chapitre. Aux chapitres 5 et 6, le cadre vide reste.
- **L'aide après trois défaites**, à partir du chapitre 5, vient de la fillette au bonnet, et non plus de Mina.
- **Le combat final** (chapitre 6, arène `voix`, musique `dodo_v2`) — on ne frappe pas le sommeil :
  1. **Les moutons** : un par défaite du joueur (`meta.deaths`, au plus 41 ; sans défaite, 41, « ses nuits ») ;
  2. **DORMIR** : le menu se change en DORMIR, les mots du carnet sont ceux de Dodo, sous-titrés comme des répliques de
     l'appel ; un tour, annoncé, **les couleurs mentent** (des crayons jaunes qui blessent un cœur jaune, HUD « ? ») ;
  3. **Les coups** : écran noir, des coups derrière un mur, qu'on compte puis auxquels on répond (« deux » à un coup,
     « trois » à trois coups ; Dodo ajoute de faux coups) ;
  4. **Les mots de Mina**, de la main de la Petite au Bonnet (merci, pardon, au revoir, je t'aime, lumière, matin, je
     suis là, bonne nuit) ; OBJET › Bouton doré (une piste brouillée, une grosse fissure) et › Pile chargée (la piste 1,
     nette, une fois). ÉPARGNER devient **OUVRIR LES YEUX** ; puis le choix [Ouvrir les yeux] / [Rester].
- **Objets** : Bouton doré (objet clé du chapitre 1, à garder), Yeux de rechange (soin neutre, boutique), Coton gris
  (chapitre 3), « Coton chaud » (PV max en plus le temps du chapitre 4, pris aux moutons-poupées), Pile chargée
  (chapitre 6), Bracelet « NOA » (cosmétique).

**Progression**

- **Étoiles** (apaiser) → augmentent les PV max.
- **Encre** (vaincre) → augmente l'attaque… et assombrit l'histoire.
- Monnaie : **Boutons** (pour la boutique de Chaussette).

### 3.4 Bestiaire

**Version 1.0** — le Hibou de Papier est devenu un PNJ (le gardien de la bibliothèque du chapitre 2).

| Ennemi | Chapitre | Émotion | Besoin | Attaques |
|---|---|---|---|---|
| Gribouille | 1 | Neutre | un mot joyeux | Boules d'encre lentes (tutoriel) |
| Nuage Triste | 1 | Tristesse | Tristesse (empathie) — déteste la Joie | Pluie bleue |
| Mouton Noir | 1 | Colère | Colère puis Joie | Charges de cornes rouges |
| Pissenlit | 1 | Joie | Joie — déteste la Colère | Graines jaunes en spirale |
| Chaussette Perdue | 1 | Tristesse | mot spécial « paire » | Pelotes rebondissantes |
| **Monstre du Placard** | Boss 1 | Peur → Tristesse | Joie + objet *Veilleuse de poche* | Cintres, portes qui claquent |
| Taille-Crayon | 2 | Colère | Tristesse | Copeaux rotatifs |
| Avion en Papier | 2 | Neutre | Joie ×2 | Avions qui piquent en éventail |
| Luciole Éteinte | 2 | Tristesse | Joie | Étincelles bleues/jaunes |
| **Gomme** | Boss 2 | Colère → Tristesse | « garder », « souvenir » | Efface la boîte, efface tes mots |
| Bip | 3 | Peur | Tristesse | Lignes d'électrocardiogramme |
| Perfusion | 3 | Tristesse | Joie ×3 | Gouttes qui tombent en rythme |
| **Dodo** | Ch. 3 | Toutes | v1.1 : les mots de Mina (merci, pardon, au revoir…) ; v2 : « pardon » trois fois (combat court) | Moutons qu'on compte, berceuse, menu qui se change en DORMIR |

Le bonus (1.1) a ses propres ennemis : Sonnette, Café Serré, le Panier de linge et **le Réveil** (boss).

**Version 2.0** — chapitres 3 à 6 (fichiers `src/data/enemies-ch3.ts` à `enemies-ch6.ts`). Les ennemis ordinaires ont
de 30 à 48 PV (la Gribouille Noire 14, la Poupée-Maman 60) et 4 à 6 d'attaque ; La Couseuse 150 PV, Le Petit Homme
200, La Vitre 180, Dodo 365.

| Ennemi | Chapitre | Émotion | Besoin | Attaques | Détail |
|---|---|---|---|---|---|
| Bracelet | 3 | Peur | Tristesse ×2, puis « prénom » — déteste la Joie | s'enroule et resserre la boîte | un bracelet d'hôpital-ver : « MINA — 304 », puis « NOA — ??? » ; épargné, il se referme sur le poignet de Noa |
| Pâte Froide | 4 | Tristesse | Tristesse ×2 — déteste la Joie | pluie de nouilles blanches, spores bleues | marche sur des pattes de fourchette ; « Il y a des pâtes. » |
| Mot Aimanté | 4 | Colère | Colère, puis Joie ×2 | lettres attirées vers le cœur, dentiers qui claquent | les aimants mâchent les mots du frigo ; épargné, il recrache « JE T'AIME » |
| Dé-Chevalier | 4 | Colère | Tristesse ×3 | pluie et lances d'épingles | « Je protège le doigt. Pas le reste. » |
| Poupée Brouillon | 4 | Peur | Tristesse ×2 — déteste la Joie | gribouillis qui redessinent la boîte | une poupée pas finie, sans visage : « Je devais être quelqu'un. » |
| Clé | 4 | Peur | Tristesse, puis « ouvrir » | verrouille une commande du menu par tour | ouvre la porte d'entrée de la Nuit 22 ; personne ne sort |
| Poupée-Maman | 4 (combat unique) | Neutre | Tristesse puis « merci », **ou** « reste » tout de suite (`c4_reste`) | assiettes blanches qui glissent | bouche cousue en sourire ; ne tombe pas : frappée, elle se recoud |
| **La Couseuse** | 4, mini-boss | Colère → Peur | Tristesse ×2, puis « découdre » | lignes de piqûre qui durcissent en murs, aiguille qui épingle le cœur, boutons du menu cousus | machine à coudre à tête de mouton ; épargnée : T3 ; vaincue, Mina n°366 se fige |
| **Le Petit Homme de la Maison** | 4, boss | Colère → Peur | Peur, puis Tristesse ×2, puis « rendre » | portes qui claquent, nouilles ; arène noire, seul le cône de la veilleuse est sûr | une poupée-Noa en tablier, la veilleuse cousue contre lui ; épargné : « J'avais peur du noir. Moi. Pas elle. » ; vaincu, la veilleuse se fêle |
| Crabe-Bracelet | 5 | Colère | Tristesse ×2 | pinces en arc, le fermoir qui se referme sur le cœur | sa carapace est un bracelet « MINA — PÉD. 3 — 304 » |
| Mouette | 5 | Joie | Colère, puis Joie | vole un mot du carnet à chaque tour | « Mine ! Mine ! », jusqu'à ce que ça sonne comme « Mina » |
| Masque | 5 | Peur | Joie ×2 — déteste la Colère | rétrécit la boîte de dialogue, étouffe le texte | un sourire dessiné au feutre |
| Gel | 5 | Colère | Tristesse ×2 | gouttes qui piquent trois fois, flocons blancs | sent l'alcool ; la boîte se gerce |
| Thermomètre | 5 | Peur → Colère | « fièvre » | le chiffre monte à chaque tour ; à 40, attaque pleine largeur | « ça va » le fait bondir |
| Gribouille Noire | 5 | aucune | ne s'apaise pas : fuir | se dédouble à chaque coup | « Ça n'a pas de cœur. C'est juste de la peur dessinée. » |
| **La Vitre** | 5, boss | Tristesse | Tristesse ×2, puis « je ne sais pas » (d'abord « pardon » si Noa a menti au portail) | buée (vision), condensation (gouttes bleues), fissures (lignes rouges) | derrière la buée, la Petite au Bonnet dessine ; épargnée, les deux mains se rejoignent ; vaincue, un lit vide |
| Aiguille | 6 | Colère | Tristesse ×2 — déteste la Colère | coud le cœur : couleur bloquée deux tours | file en traçant des points |
| Bouton Pendu | 6 | Peur | « regarder », ou Tristesse ×2 | balancier qui balaie la boîte | un œil-bouton au bout d'un fil |
| Bourre | 6 | Tristesse | « pardon » | se colle et ralentit | n'existe que si Noa a vidé des moutons au ch. 4 (`c4_coton`) |
| Mouton Numéroté | 6 | Joie | Joie | se multiplie si on ne les épargne pas par numéro décroissant | tamponné comme un dossier |
| **Pile** | 6, rencontre unique | Neutre → Tristesse | Joie, puis « garder » | fuite, grésillement ; sa voix ralentit à chaque tour | épargnée : la Pile chargée (`c6_pile`) ; vaincue : la fin secrète est perdue |
| **Dodo** | 6, combat final | — | quatre phases (voir 3.3) | moutons, DORMIR, coups, mots de Mina | 365 PV ; on ne peut pas le vaincre par la force |

### 3.5 Méta / quatrième mur (style DDLC / Undertale)

- Le jeu demande **ton** nom, pas celui de Noa. Dodo s'adresse à toi.
- Mémoire persistante séparée de la sauvegarde : le jeu se souvient des nouvelles parties, des morts, des fins vues.
- L'heure réelle : jouer entre minuit et 5h déclenche des répliques (« Il est 3h12. Tu devrais dormir, toi aussi. »).
- Changer d'onglet : le titre de la page change (« Ne pars pas »), Dodo le remarque à ton retour.
- Glitchs maîtrisés : texte corrompu, faux plantage, boutons du menu effacés pendant le combat final, écran-titre qui évolue.

**Méta et nouvelle partie+ (2.0)** — ce que la mémoire retient (`Meta`, `src/game/state.ts`) et où ça se voit
(bible § 5 ; chaque ligne a son scénario de preuve dans `docs/INDICES.md`) :

| Mémoire | Où ça se voit |
|---|---|
| `nuits` (365, +1 par fin) | L'emplacement de sauvegarde s'appelle « Nuit 366 » ; une couronne de plus dans le grenier à chaque partie |
| `callVersion` | En nouvelle partie+, au bout du couloir des 41 portes : « La dernière fois, tu as choisi la douce. » — « C'est pratique, la mémoire. » |
| Une fin v1.1 déjà vue | Le faux générique : « Tu croyais que c'était fini, la dernière fois. » |
| `fauxGenerique` | Interlude II : « Cette fois, tu sais que ça ne s'arrête pas au générique. » |
| `deaths` | Les moutons de la phase 1 du combat final, un par défaite |
| Départ d'onglet (dès le ch. 4) | Au retour, une page : « Pendant ton absence, Noa a dit : … », une réplique de plus à chaque doublement du temps |
| Heure réelle 3 h 14, pendant un interlude | Le téléphone sonne, « Mina 🐑 », appel entrant ; on ne peut pas répondre ; puis « appel manqué » |
| Heure réelle entre minuit et 5 h | Les boîtes du narrateur prennent le bip de Dodo |
| `dodoSilent` (après la fin secrète) | Prologue sans Dodo ; Dodo ne parle plus jamais |
| Toute fin v2 | Prologue : « Tu reviens. Tu sais, toi. … Tu ne lui diras rien, hein ? » |
| `lastEnding` | L'écran titre : l'aube, le soleil blanc (*Aube blanche*), « Continuer » seul avec les jours comptés (*Beaux rêves*), la photo au blanc en forme d'enfant (*Silence*), la veilleuse branchée à l'aube (*Veilleuse*) |

En nouvelle partie+, la fin secrète a ses indices : Madame Lune (« Le bouton secret… faut appuyer fort. »), Chaussette
si on lui a vendu le bouton (« Il faisait un drôle de bruit quand on le serrait. »), le mot de Nadia sur les piles, et
un bocal du chapitre 6.

---

## 4. Direction artistique

- **Résolution interne 320×180**, mise à l'échelle entière (nets pixels sur 720p, 1080p, 1440p, 4K, mobiles).
- **Rêve** : pastels, contours prune foncé, textures « crayon », lucioles, coton qui tombe.
- **Réel** : palette désaturée bleu nuit, lumière limitée (veilleuse, écran de télé, lune à la fenêtre), grain.
- **Horreur** : encre noire qui coule, aberration chromatique, déchirures horizontales.
- **Matières de la v2**, une par acte : le **feutre** (chaud, contour cousu) et le **stylo bille** (encre noire sur
  blanc cassé, quadrillage, hachures) au chapitre 4 ; le **blanc** (blanc sur blanc, trait bleu, correcteur) au
  chapitre 5 ; la **ouate** (coton jauni, fil rouge, épingles) au chapitre 6 ; le **faux** (sursaturé) pour la fausse
  aube. Les cartes de chapitre suivent : au crayon sur une page du carnet de Mina (1 à 3), au stylo raturé (4), au stylo
  bleu sur du correcteur (5), sur du papier quadrillé cousu de fil rouge (6).
- Sprites 16×24 (personnages), 16×16 (tuiles), 32–64 px (ennemis), portraits 32×32.
- Police bitmap maison avec tous les accents français.

## 5. Direction sonore

- Synthèse 100 % procédurale (Web Audio) : aucun fichier audio, chargement instantané, hors-ligne.
- **Leitmotiv** : *La Berceuse de la Veilleuse* (boîte à musique, 3/4), décliné dans chaque morceau. Au chapitre 6, la
  boîte à musique la joue en entier pour la première fois.
- Morceaux : titre, chambre, prairie, village, boutique, combat, boss, forêt, hôpital, Dodo, fin, game over ; en v2,
  la maison cousue (jour et nuit), La Couseuse, Le Petit Homme, la plage, le sas, La Vitre, le ventre de Dodo,
  l'appel, le combat final et le faux générique (une note tenue quand il se bloque, la musique à l'envers quand il
  remonte).
- « Voix » des personnages façon *Undertale* (bips de texte à timbre unique). Le bip de Dodo est celui de Noa,
  transposé vers l'aigu.

## 6. Contrôles

| Action | Clavier | Manette | Tactile |
|---|---|---|---|
| Se déplacer | Flèches / ZQSD / WASD | Stick / croix | Croix virtuelle (ou glisser pendant l'esquive) |
| Valider / interagir | Z / Entrée / Espace | A | Bouton A, ou toucher l'objet |
| Annuler / courir | X / Échap / Maj | B | Bouton B |
| Menu | C / Tab | Start / Y | Bouton ☰ |

Les scènes de comptage se jouent avec A au bon moment (ou en touchant l'écran), puis en choisissant un nombre ; le
dessin à deux, en tenant A (ou le doigt) pour suivre le pointillé.

## 7. Accessibilité

Vitesse du texte, volumes séparés, désactivation des secousses et des flashs, filtre CRT optionnel, **mode Histoire**
(dégâts réduits de 75 %), taille et opacité des contrôles tactiles, avertissement de contenu au démarrage,
ressources d'aide (3114) dans les crédits.

En v2 :

- **« Réduire les attentes »** (nouvelle option) : les attentes en temps réel sont raccourcies (la serviette du
  chapitre 5 : 5 secondes au lieu de 30 ; l'appel de 3 h 14 ne sonne que quelques secondes).
- **« Réduire les flashs »** couvre aussi les glitchs (plus de déchirures ni de salves) et tous les nouveaux effets :
  le faux générique, les fissures et l'éclatement de La Vitre, le changement de nom de T7, l'arène noire et les fissures
  du combat final ne dépassent jamais un quart de la lumière de l'écran.
- **Mode Histoire** sur les comptages : les coups et la boîte à musique sans leurres, plus lents ; l'attente de la
  serviette ramenée à 5 secondes ; la boîte à musique, comme les moutons, se laisse passer après deux échecs.
- **Formes des émotions** : le « ? » des couleurs qui mentent reste lisible.
- **Avertissement de contenu** réécrit pour la v2 (bible § 6.3) et **carte d'aide** (3114) après *Beaux rêves*,
  *Silence* et *Aube blanche*.
