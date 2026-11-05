# Scénario détaillé — VEILLEUSE

> **Version 2.0 : la référence est [`docs/HISTOIRE.md`](HISTOIRE.md)**, la bible de « Il fait toujours nuit » (la
> vérité, les neuf révélations T1 à T9, les trois actes et six chapitres, les fins, la méta, les limites de contenu).
> En cas de contradiction, elle l'emporte. Ce document garde le détail des scènes écrites pour la v1.1, qui restent la
> base de l'acte I. Chaque section touchée par la v2 commence par un encadré **v2** (ce qui change, la section de la
> bible, le module de `src/game/story/`) ; les segments nouveaux n'ont qu'un résumé. Les indices ajoutés, avec leur
> fichier:ligne et leur scénario de preuve, sont dans [`docs/INDICES.md`](INDICES.md).

> Version 1.1 : document de référence pour l'écriture des scènes. Il fixe la **structure**, les **révélations** et
> les **arcs** pour que les quatre fils (réel, chapitres 1 à 3) restent cohérents. Les dialogues exacts sont écrits
> dans le code ; les répliques citées ici sont des exemples de ton, à reprendre ou améliorer.

## Déroulé de la version 2

| | Segment | Module (`src/game/story/`) | Cartes | v2 |
|---|---|---|---|---|
| P | Prologue — « Il fait nuit » | `real.ts` | `chambre` | retouché |
| 1 | Chapitre 1 — « Le Pays de Coton » | `chapter1.ts` | `prairie`, `village`, `boutique`, `maison_mouton`, `colline` | retouché |
| I | Interlude I — « Le frigo » | `real.ts` | `chambre`, `appartement` | retouché |
| 2 | Chapitre 2 — « La Forêt de Crayons » | `chapter2.ts` | `lisiere`, `foret`, `bibliotheque`, `clairiere`, `sentier_gomme`, `atelier` | retouché |
| II | Interlude II — « La porte », 3 h 33 | `real.ts` | `chambre`, `appartement_nuit` | retouché |
| 3 | Chapitre 3 — « L'Hôpital de Papier » | `chapter3.ts` | `ruines`, `hopital`, `salle_jeux`, `chambre_304`, `vide` | retouché, combat court |
| FA | La fausse aube | `fausse-aube.ts` | `chambre_faux`, `appartement_faux` | nouveau |
| III | Interlude III — « Le sac », 4 h 06 | `real-nuit.ts` | `chambre`, `appartement_tard` | nouveau |
| 4 | Chapitre 4 — « La Maison Cousue » | `chapter4.ts` | `maison_feutre`, `maison_stylo`, `grenier`, `couloir_coups` | nouveau |
| IV | Interlude IV — « Le placard », 4 h 44 | `real-nuit.ts` | `chambre`, `appartement_tard`, `chambre_maman` | nouveau |
| 5 | Chapitre 5 — « La Marée Blanche » | `chapter5.ts` | `plage`, `sas`, `lac_blanc`, `chambre_verre` | nouveau |
| 6 | Chapitre 6 — « Le Ventre de Dodo » | `chapter6.ts` ; combat final `src/game/battle/final-v2.ts` | `couture`, `ouate`, `boite_a_musique`, `couloir_41`, `voix` | nouveau |
| F | Final — « Le carnet », 5 h 52 | `real.ts` | `chambre`, `appartement_aube`, `chambre_mina` | réécrit |
| — | Les fins | `endings.ts` | `appartement_br`, `appartement_silence` | cinq fins et une non-fin |
| E | Épilogue — « Une veilleuse neuve » | `epilogue.ts` | `bazar`, `jardin` | retouché |
| B | Bonus — « La nuit de Maman » | `bonus.ts` | `b_service`, `b_appart`, `b_noa`, `b_hopital`, `b_304` | retouché |

Les chapitres 2 à 6 se passent pendant la même nuit, la 365ᵉ ; entre deux chapitres, Noa remonte à la surface et
l'horloge avance, sauf du chapitre 5 au chapitre 6 où il tombe (`fallInto(d, 6)`). Le flux complet d'une partie est
dans `docs/ARCHITECTURE.md`.

## Arcs à tenir sur toute la durée (v1.1)

> **v2** — Les arcs de la v2 (Mina, Dodo, le narrateur, le joueur, le monde réel), acte par acte, sont au § 3.2 de la
> bible. Le « secret » ci-dessous est la vérité de la v1.1 (T0) : la v2 la garde jusqu'à la porte 304, puis la
> retourne.

| Arc | Prologue | Ch. 1 | Interlude I | Ch. 2 | Interlude II | Ch. 3 | Final |
|---|---|---|---|---|---|---|---|
| **Vérité sur Mina** | rien | elle est « là », tout va bien | indices (dessins, porte fermée) | elle oublie des choses, se fige | message vocal : « ça fait un an demain » | elle se souvient, puis est effacée | le carnet |
| **Dodo** | mignon, guide | serviable, explique tout | la peluche a bougé | 1ʳᵉ fêlure (« Chut. ») | parle dans le réel | se révèle : le sommeil sans fin | redevient peluche (aube) |
| **Le joueur** | Dodo connaît son nom | clin d'œil | — | Dodo le remarque quand il revient | « Ne pars pas » (titre d'onglet) | Dodo le supplie / le menace | Dodo le remercie |
| **Monde réel** | nuit, pluie | — | gris, frigo, mot de Maman | — | plus sombre, couloir qui s'allonge, 3h33 | — | aube |

Le « secret » (Noa n'est pas allé voir Mina les dernières semaines ; le dernier soir elle a demandé sa veilleuse et
il ne l'a pas apportée) n'est **dit clairement qu'au chapitre 3**. Avant, seulement des fragments.

---

## Prologue — « Il fait nuit » (fil RÉEL, carte `chambre`)

> **v2 (retouché, bible § 3.3)** — Tout reste ; des indices s'ajoutent : la veilleuse au 2ᵉ examen (« Elle a toujours
> été là, sur ta table de nuit. …Non ? »), le calendrier (« visite ? » raturé, « elle va mieux !! »), le casque, le
> tiroir (« Tu sais ce qu'il y a dedans. Non. Tu ne sais pas. »), le mur contre le lit, la couture rouge sur le ventre
> de Dodo, le fil épinglé « Mina 🐑 » qu'on n'ouvre pas. Le bip de Dodo est celui de Noa, transposé. En nouvelle
> partie+, Dodo : « Tu reviens. Tu sais, toi. … Tu ne lui diras rien, hein ? » ; après la fin secrète, il ne s'éveille
> plus et Noa glisse seul sous le lit.

1. Écran noir. Narration centrée : « Il fait nuit. » … « Il fait toujours nuit. » Bruit de pluie.
2. Fondu : Noa allongé dans son lit (`prop_bed_sleeping`), il se lève (le lit redevient `prop_bed`, Noa apparaît à
   côté). Courte bannière « Chambre de Noa ». Le joueur prend la main. Indication discrète des contrôles (selon
   l'appareil : « Flèches pour marcher, Z / Entrée pour examiner » ou « Croix et bouton A »).
3. Objets à examiner (chacun 1–3 boîtes, voix de Noa en pensée, narrateur sobre) :
   - **veilleuse** (lune, grésille) : « La veilleuse de Mina. Elle grésille depuis des semaines. Tu ne la changes
     pas. » → c'est aussi le point de sauvegarde du monde réel.
   - **photo retournée** : « Tu ne la retournes pas. »
   - **calendrier** : arrêté sur un mois de l'an dernier.
   - **bureau / téléphone** : 14 messages non lus de « Maman ». Le dernier : « Je rentre tard. Il y a des pâtes. »
     Le fil s'ouvre en plein écran (`PhoneScene`, `src/game/scenes/phone.ts`) et Noa **peut répondre** (voir
     « Répondre à Maman » plus bas) → `p_reply`.
   - **fenêtre** : la pluie, la lune derrière les nuages.
   - **armoire** : « Tu n'aimes pas la laisser ouverte la nuit. »
   - **porte** : « Tu n'as pas envie de sortir. » (bloquée pendant le prologue)
   - **Dodo en peluche** sur le lit → déclenche la scène.
4. **Dodo parle.** Il « s'éveille » (`npc_dodo` qui flotte au-dessus du lit). « Tu ne dors pas ? » / « Moi c'est
   Dodo. Tu te souviens ? Mina m'a donné à toi. Elle a dit : il veillera sur toi. »
   Puis il se tourne vers l'écran : « Et toi… tu es qui ? Pas Noa. L'autre. Celui qui tient sa main. » — « Ah.
   **{player}**. C'est joli. » (Ne pas trop insister : un frisson, pas un cours sur le quatrième mur.)
   « Noa n'arrive plus à dormir. Mais moi, je connais un endroit où personne n'est jamais triste. Regarde sous
   le lit. »
5. Examiner le lit : « Glisser sous le lit ? » [Oui / Non]. Oui → `enterDream(d, 1)`.

## Chapitre 1 — « Le Pays de Coton » (fil CH1)

> **v2 (retouché, reste tendre, bible § 3.4)** — Une fausse note par lieu, chacune avec son double ordinaire. Prairie :
> bâtons gravés sur la tête de lit, traces de bottes à la pointure de Noa, la toux sous le coton, les couettes « en
> laine » ; dans le trésor de Mina, le **Bouton doré** (« Faut appuyer fort. ») et ses dents de lait. Village : le code
> des coups devant la porte du Mouton Noir (1 « t'es là ? », 2 « je suis là », 3 « bonne nuit »), Madame Lune
> (« Encore t— », « Aller. Et retour. », « Il y en a un qui fait semblant. »), le mouton compteur à « trois cent
> soixante-quatre », le mouton borgne ; chez Chaussette, les Yeux de rechange, et elle rachète le Bouton doré (le
> vendre ferme la fin secrète, `c1_bouton_vendu`). Colline : le Moutonnier aux yeux cousus, une silhouette en bonnet
> derrière un oreiller. Le Placard épargné : « Je l'ai gardée pour moi, la lumière. J'avais si peur. » Après *Beaux
> rêves*, « Continuer » ramène ici.

Ton : merveilleux, drôle, tendre. Le malaise est minime (une ou deux notes fausses).

1. Carte de chapitre. Noa se réveille dans un **lit au milieu d'une prairie** (`prop_bed_dream`), du coton tombe
   du ciel. Dodo flotte à côté : « Bienvenue au Pays de Coton ! »
2. **Tutoriel de combat** avec `gribouille` (combat `tutorial: true`) : Dodo explique en `beforeTurn` / bulles :
   ton cœur ; FRAPPER ; ÉCRIRE (un mot change la couleur de ton cœur) ; la **résonance** (« Les projectiles de la
   même couleur que ton cœur te traversent. ») ; ÉPARGNER quand le nom devient jaune. Dodo conclut : « Tu vois ? Ici,
   pas besoin de faire du mal. »
3. Premier **point de sauvegarde** (veilleuse) : Dodo : « Quand tu vois une petite lumière comme ça, touche-la. Ça
   garde le rêve au chaud. »
4. **Rencontre avec Mina** : « HALTE, MONSTRE ! » — elle surgit d'un buisson, crayon-épée levé. « … Oh. C'est toi,
   Noa ! » Noa (portrait surpris) : « …Mina ? » — « Ben oui ! Qui d'autre ? Je suis la Princesse-Chevalière du
   Pays de Coton, je te signale. » Elle rejoint l'équipe (`d.follower('mina')`).
   Quête : une **étoile filante** est tombée sur la Colline aux Couvertures — « Si on la trouve, on fait un vœu ! »
   Dans la prairie, en option : Mina réagit au lit (« Il grince pas »), au rocher au smiley (« Il te ressemble. …
   Avant. Quand tu souriais. »), au buisson aux traces de bottes ; **secret** : le trésor de Mina caché en bas à
   gauche (boîte « PAS TOUCHE. (sauf Noa) » : billes, bouton doré, une plume « qui écrit toute seule quand on est
   triste », un biscuit étoile) → `c1_tresor`.
5. **Village des Moutons** (`village`) : PNJ moutons drôles (un qui compte les autres pour s'endormir, un poète,
   un qui a peur de son ombre, un agneau qui a perdu son **ballon rouge** — quête annexe : le ballon est coincé dans
   un arbre de la prairie, récompense `crayon de cire` = arme `cire`), **Madame Lune** (endormie, parle en bâillant,
   sibylline : « Tout le monde finit par se réveiller… ou presque. »), elle donne la **Veilleuse de poche** si on lui
   parle deux fois (« Pour ceux qui ont peur du noir. »). **Boutique de Chaussette** (`boutique`) : marchande
   joviale à qui il manque sa paire. **Maison d'un mouton** (`maison_mouton`) : intérieur cosy, un lit où l'on peut
   faire une sieste (soin) ; on peut y trouver le `plaid` ? (non : garder `plaid` pour le ch. 2).
   Mina commente beaucoup de choses (tableau d'affichage avec **ses** dessins : « C'est moi qui les ai faits ! …
   Enfin je crois. »).
   **1.1 — plus de matière (optionnel)** : les PNJ ont une 2ᵉ / 3ᵉ réplique et changent selon la progression
   (`c1_ballon_rendu`, `c1_sheep_done`) : le mouton qui se compte lui-même parle de son **grand frère le
   Moutonnier** « là-haut sur la colline » ; le poète trouve sa rime (« …toute la semaine ») ; le peureux et son
   ombre (Mina : « Une ombre, c'est de la lumière avec un trou dedans. C'est Maman qui dit ça. ») ; le banc
   « M + N » (Mina ne se souvient pas de l'avoir gravé) ; frapper chez le Mouton Noir (« …Bonne nuit quand
   même. ») ; le puits (« Garde ton vœu pour l'étoile ») ; le tableau affiche le ballon rendu et un « MERCI AU
   GRAND COMPTEUR DE MOUTONS » ; Madame Lune, après les moutons : « À force de compter, certains s'endorment pour
   de bon. »
6. **Chaussette Perdue** (ennemi visible, route du village) : mot spécial « paire ». Si épargnée → elle retrouve la
   marchande ; flag `c1_chaussette_paire` ; Chaussette offre une réduction / un cadeau.
7. **Colline aux Couvertures** (`colline`) : sol en courtepointe, murs d'oreillers, ennemis. Avant le sommet,
   point de sauvegarde. Mina : « Les monstres sous le lit, ceux dans le placard… j'avais peur d'eux. Avant. »
   - **Énigme : compter les moutons** (1.1, `src/game/scenes/sheepcount.ts`). Deux oreillers géants bouchent le
     chemin du sommet : « Le soir, les oreillers ne se poussent que quand tous les moutons sont comptés et
     couchés. » Le **Moutonnier** (grand frère du mouton du village) garde un enclos (deux moutons, un mouton noir
     boudeur) mais s'endort toujours avant la fin. Jeu de rythme : les moutons trottent et sautent la barrière ;
     on appuie sur A (ou on touche l'écran) quand un mouton passe **au-dessus**. Manche 1 « Doucement » (un mouton
     hésite : on attend qu'il saute), manche 2 « Le mouton noir » (on ne le compte **jamais**, des moutons sautent
     à deux), manche 3 « Les yeux fermés » (le Moutonnier dort : on compte dans sa tête, puis on donne le total
     parmi trois nombres ; un mouton peut s'endormir sans sauter). Fenêtres larges, barrière qui s'illumine, deux
     erreurs permises, nouvel essai libre (la séquence de la manche 3 change), « Plus tard » pour revenir, et après
     deux échecs **« Je n'y arrive pas »** : « Moi non plus, je n'y arrive jamais… ils sont tous couchés quand
     même. » (`c1_sheep_helped`). Réussite → les oreillers s'écartent, lait chaud, `c1_sheep_done` (progression :
     `c1_sheep_round`, `c1_sheep_fails`). On peut recompter pour le plaisir.
     *Présage* : même saut, même rythme, mêmes moutons (`b_sheep`, `b_sheep_big` un sur quatre), même « bêê » qui
     monte que le motif `sheep_count` de Dodo au combat final, sur la berceuse de `mina`. Et le Moutonnier :
     « C'est un grand mouton tout doux qui m'a appris à compter. Il dit qu'à force de compter, on oublie tout le
     reste. C'est reposant, d'oublier… » — Mina : « Moi, je veux rien oublier. »
   - **Scène optionnelle : l'oreiller géant** (près du sommet, avec Mina) : assis tous les deux, le coton qui tombe
     sur le Pays de Coton. Mina se souvient du « bonhomme de neige tout petit, sur le rebord de la fenêtre, parce
     qu'on avait pas le droit de sortir » — « Pourquoi, déjà ? » (Noa : « Il faisait trop froid. » → « Ce n'était
     pas le froid. ») ; elle mange le coton ; « Si un jour j'oublie des trucs… tu me les raconteras ? » (« Promis. »
     → `c1_promesse`). Soin complet. Prépare le chapitre 2 (Mina oublie) sans rien révéler.
8. **Boss : le Monstre du Placard** (armoire seule au sommet). Il a peur du noir lui aussi. Hooks : au tour 2 ou 3
   Mina s'écrie : « Noa ! Il a peur du noir, lui aussi ! » ; utiliser la **Veilleuse de poche** (OBJET) le rend
   apaisable d'un coup (ou compte comme 2 mots), sinon 4 mots de JOIE. Épargné → il devient `npc_placard` gentil
   (flag `c1_placard_spared`). Vaincu → il fond en encre, Mina se tait : « …Il voulait juste de la lumière. »
9. **Pas d'étoile**, mais un **souvenir** : `d.souvenir('fenetre')` + `d.image('souvenir_fenetre', …)`. Noa a mal
   à la tête, flash blanc, bip lointain d'hôpital. Mina : « Noa ? Ça va ? Tu fais une drôle de tête. » Dodo apparaît :
   « C'est l'heure de se réveiller… pour l'instant. » → `wakeUp(d, 1)`.

## Interlude I — « Le frigo » (fil RÉEL, `chambre` + `appartement`)

> **v2 (retouché, bible § 3.5)** — Une seconde photo dans le couloir (un petit garçon et un mouton plus gros que lui),
> l'étiquette de Dodo (« N… »), le dos du mot du frigo raturé, la porte de Maman sans serrure, et au lit : « Pas
> maintenant. Pour l'instant. »

Jour gris, pluie, lumière blafarde. Musique `interlude`.

1. Noa se réveille. Dodo est une peluche immobile. Le téléphone vibre : un message de Maman (« Tu as mangé ? »),
   précédé d'un mot qui répond à `p_reply` (« Merci pour ton « ok », hier. », « J'ai relu ton message dix fois. »…).
   Réponse possible → `i1_reply` (« Oui. » est un mensonge tant que Noa n'a pas mangé : « Ce n'est pas vrai. Pas
   encore. »).
2. L'appartement s'ouvre (`appartement`) : couloir, salon (télé éteinte, canapé, photo), cuisine (frigo avec mot
   aimanté : « Noa, mange quelque chose s'il te plaît. Je t'aime. — Maman », et des dessins de Mina), salle de bain
   (miroir : « Tu évites ton reflet. »), chambre de Maman (fermée : « Elle n'est pas rentrée. »), **porte de Mina**
   (pancarte « CHAMBRE DE MINA — DÉFENSE D'ENTRER (sauf Noa) ») : « Tu poses la main sur la poignée. Tu ne peux
   pas. », porte d'entrée (« Dehors, il pleut. Tu n'as pas envie. »).
3. Manger (optionnel, cuisine) → `i1_ate`, soin, petite scène (pâtes froides, « C'est bon, en fait. »).
4. Retourner au lit → « Dormir ? » → `enterDream(d, 2)`.

## Chapitre 2 — « La Forêt de Crayons » (fil CH2)

> **v2 (retouché, bible § 3.6)** — Les arbres-crayons saignent de l'encre quand on les taille ; un trou gommé chuchote
> des nombres, un autre cache une petite figure en bonnet ; à la bibliothèque, le livre qui répète « Tu es revenu ! »,
> le conte écouté « à travers un téléphone », « Ce carnet n'a que trois pays » ; dans la lumière bleue, des fils
> au-dessus des poignets de Mina ; Mina se fige avec des yeux-boutons et demande « Qui c'est qui parle, quand c'est
> écrit en blanc ? » ; le bocal de miettes « qui ont une bouche » ; Gomme épargnée : « On efface pour ne plus avoir
> mal. Ou pour ne plus être coupable. » ; un petit nuage gris sur le souvenir 2 ; de la friture dans la voix de Dodo
> (« Ch—t. »).

Ton : mélancolique, mystérieux. Mina commence à oublier.

1. Carte de chapitre. Noa arrive à la **Lisière** (`lisiere`) ; Mina l'attend assise sur une souche : « Tu es
   revenu ! Tu as dormi super longtemps. » Dodo est là. Chaussette (marchande itinérante) a installé un étal (si
   `c1_chaussette_paire` : elle est avec sa paire, ravie).
2. **Forêt de Crayons** (`foret`) : arbres-crayons géants, sol de papier ligné, gribouillis. Ennemis : taille-crayon,
   avions en papier, lucioles éteintes. Des zones **gommées** (`erased`) : trous blancs dans le monde — inquiétant.
   Mina : « Avant, il y avait des fleurs ici. Je crois. »
3. **Clairière des Lucioles** (`clairiere`) : **énigme des lanternes** — allumer 4 lanternes (rouge, jaune, vert,
   bleu) dans l'ordre indiqué par un dessin d'arc-en-ciel / une comptine sur un panneau ; récompense : le **plaid**
   (armure) et le passage vers l'atelier. Mauvais ordre → elles s'éteignent.
4. **Bibliothèque du Hibou** (`bibliotheque`) : le Hibou en papier parle par énigmes, garde « les livres que
   personne ne lit ». Il parle d'un carnet « écrit pour quelqu'un qui ne l'a jamais ouvert ». Indice pour l'énigme.
5. Mina **se fige** au milieu d'une phrase (sprite immobile, petit glitch), puis reprend comme si de rien n'était.
   Plus tard : « Noa… c'est grave si on oublie des choses ? »
6. **Atelier de Gomme** (`atelier`) : Gomme efface les dessins de la forêt. « Ce qui est effacé ne fait plus mal. »
   **Boss Gomme** : elle efface des mots du carnet (hook `words` : certains mots deviennent « ______ »), rétrécit la
   boîte. Besoin : TRISTESSE ×2 puis le mot **« garder »** (ou « souvenir »). Épargnée : « Tu veux garder… même ce
   qui fait mal ? … D'accord. » Elle rend les dessins effacés (flag `c2_gomme_spared`). Vaincue : les zones
   gommées restent.
7. **Souvenir 2** : `souvenir('dessin')` — le dessin inachevé (deux enfants sous une grande lune). Mina : « Je l'ai
   pas fini… parce que… parce que » → glitch fort (`{glitch}PARCE QUE{/glitch}`, `face_mina_glitch`), écran qui
   tremble. **Dodo** intervient pour la première fois sur un ton froid : « Chut. On ne parle pas de ça ici. »
   Silence. Puis doux à nouveau : « Il est tard. Réveille-toi, Noa. » → `wakeUp(d, 2)`.

## Interlude II — « La porte » (fil RÉEL, `chambre` + `appartement_nuit`)

> **v2 (retouché, bible § 3.7)** — Trois coups dans le mur de Mina en entrant dans le couloir ; le reflet aux yeux
> fermés ; une image de fillette en bonnet dans la vidéo ; les pattes propres de Dodo ; le fil de Maman se remonte
> d'un an (« Elle va un peu mieux ❤ », « Tu tousses encore ? Alors tu ne viens pas, d'accord ? », les messages du
> dernier soir) ; Dodo parle dans le réel sans portrait. En nouvelle partie+ : « Cette fois, tu sais que ça ne
> s'arrête pas au générique. »

Nuit plus noire que jamais. Musique quasi absente, `hum`. Glitches discrets.

1. L'horloge affiche **3:33**. Le téléphone : un **message vocal** de Maman : « Noa… ça fait un an demain. Je… je
   rentre ce soir. On ira la voir ensemble, d'accord ? » Son début change selon les réponses précédentes (silence :
   « je sais que tu ne décroches pas » ; colère : « je sais que tu m'en veux » ; sinon : « tes petits messages, je
   les garde tous »). Puis Noa peut répondre au message → `i2_reply` (à 3h33, personne ne répond : « Distribué »).
2. `appartement_nuit` : même plan mais plus sombre (lumière limitée autour de Noa), la **télé s'allume seule** :
   vidéo de famille (`d.image('tv_mina')`, voix de Mina : « Noa ! Regarde ce que j'ai dessiné ! »), puis neige.
3. Le **couloir s'allonge** (téléportation silencieuse vers une version plus longue, ou portes qui se répètent).
4. La **peluche Dodo** est assise au milieu du couloir (elle était sur le lit). La porte de Mina est
   **entrouverte**, noir derrière : « Pas encore. » (on ne peut pas entrer).
5. De retour dans la chambre, Dodo (peluche) **parle dans le monde réel** pour la première fois : « Tu sais ce qui
   se passe quand on se réveille, {player} ? On perd tout. » `setPageTitle('Ne pars pas')`. Dormir →
   `enterDream(d, 3)`.

## Chapitre 3 — « L'Hôpital de Papier » (fil CH3)

> **v2 (retouché, finit sur la fausse aube, bible § 3.8)** — Tout reste jusqu'à la chambre 304. Ajouts : les
> infirmières de papier sans visage, toutes badgées « NADIA » ; « le chocolat du robot » (B4) qui donne du coton ; les
> numéros qui déraillent (307, 306, 305, 303½) ; un petit bonhomme qui s'approche d'une porte vitrée, d'un dessin
> scotché à l'autre ; les voix (« Le grand frère qui toussait ? », « Il croit que c'est lui. ») ; la silhouette en
> bonnet au bout de la boucle et dans la vitre de la dernière aile ; un nouvel ennemi, **Bracelet** (« MINA — 304 »,
> puis « NOA — ??? », mot spécial « prénom »). Dodo, trop gentil : « Tu vois ? Tu peux partir quand tu veux. »
> **Le combat contre Dodo est raccourci** : phases 1 et 2 inchangées, puis le carnet offre un seul mot de Noa,
> « pardon » ; écrit trois fois, il fissure Dodo en surface, et Dodo cède trop vite (« D'accord. Tu l'as dit. C'est
> fini. Réveille-toi. »). [Se réveiller] et [Rester] mènent tous deux à la fausse aube (`fa_reste`). La phase 3, le
> choix et la route du Silence de l'étape 6 sont ceux de la v1.1 : la v2 les a déplacés au combat final du chapitre 6.

Ton : inquiétant puis bouleversant. Monde `ink` (tuiles et sprites corrompus).

1. Carte de chapitre (lettres qui tremblent). **Ruines** (`ruines`) : le Pays de Coton noyé d'encre, moutons
   immobiles, les PNJ épargnés aux chapitres précédents sont là pour aider (le Placard éclaire le chemin si
   `c1_placard_spared`, Gomme si `c2_gomme_spared`…). Mina, effrayée : « Noa, le Pays de Coton est malade. »
   L'étoile filante est tombée sur… un **hôpital en papier**.
2. **Hôpital** (`hopital`) : couloir sans fin (boucle : il faut suivre les dessins de Mina scotchés aux murs / les
   numéros de chambre croissants, sinon on revient au début), néons qui grésillent, ennemis `bip` et `perfusion`.
   Bouts de dialogue réels entendus en passant (infirmières, Maman au téléphone : « Il ne veut pas venir… »).
   Point de sauvegarde avant la porte 304. On peut obtenir la **cape de Mina** (armure) / la **plume dorée**.
3. Devant **la porte 304**, Mina s'arrête. « Je me souviens, maintenant. » « C'était ma chambre. » « Tu n'es pas
   venu, Noa. » « J'avais demandé ma veilleuse. Le dernier soir. J'avais peur du noir. » Noa ne peut rien répondre
   (« … »). Elle ne lui en veut pas : « C'est pas grave. Je voulais juste te dire… » → **Dodo** : « Ça suffit. »
   Mina est **effacée** : glitch, faux message d'erreur plein écran (`ERREUR : souvenir_mina introuvable`),
   `d.follower(null)`, la musique coupe.
4. **Chambre 304** (`chambre_304`) : lit vide, fenêtre aux rideaux verts, dessins de Mina aux murs, et sur la table
   la **veilleuse débranchée**. Souvenir 3 : `souvenir('veilleuse')`. Noa : « … Pardon. »
5. Dodo se révèle (la pièce se dissout → `vide`) : « Reste. Ici, elle n'est jamais partie. Ici, tu n'as rien fait de
   mal. » Au joueur : « Et toi, {player}… si tu fermes le jeu, il se réveille. Et il aura mal. Tu ne veux pas lui
   faire de mal, n'est-ce pas ? » (Si `G.meta.tabLeaves > 0` : « Tu es déjà parti tout à l'heure. Je l'ai senti. »)
6. **Combat final : Dodo** (v1.1 ; en v2, le combat court de l'encadré) (`dodo_battle`, fond `void`) — Dodo ne peut
   pas être vaincu par la force (« On ne frappe pas le sommeil. »).
   - Phase 1 : moutons qu'on compte (`sheep_count`), berceuse (`lullaby`). Dodo bavarde, doux.
   - Phase 2 : il « grandit » (`b_dodo_dark`), les boutons du menu se changent un par un en **DORMIR**
     (`menuLabels`) ; choisir DORMIR assombrit l'écran et rend des PV à Dodo. Le carnet ne propose que ses mots
     (`DODO_WORDS` : dors, reste, oublie…).
   - Phase 3 : quand Noa a écrit / tenu assez longtemps, la page du carnet change d'écriture : ce sont les mots de
     Mina (`MINA_WORDS` : merci, pardon, au revoir, je t'aime, lumière, matin) — la voix de Mina (`mina`) murmure. Les
     écrire fissure Dodo (`dodo_storm`, couleurs qui changent). ÉPARGNER devient **SE RÉVEILLER**.
   - Choix final : [Se réveiller] → `set('fin_route', 'aube')`, `wakeUp(d, 3)`. [Rester] → Dodo berce Noa, fin
     **Beaux rêves** → `finishGame(d, 'beaux_reves')`.
   - **Route du silence** (`isSilenceRoute()`) : les mots de Mina sont noyés d'encre, illisibles ; Dodo : « Regarde
     ce que tu as fait. Il n'y a plus personne à qui dire au revoir. » Fin **Silence** → `finishGame(d, 'silence')`.

## La fausse aube (v2, nouveau — bible § 2.2, § 3.9 ; `fausse-aube.ts`)

Un matin trop beau (`chambre_faux`, `appartement_faux`, palette `faux`) : des oiseaux en boucle, un soleil au crayon
dans une fenêtre sur le mauvais mur, Maman déjà assise sur le lit, qui ne parle qu'avec les phrases de ses mots du
frigo ; le narrateur ment ouvertement (« Tout va bien. ») et Mina n'est nulle part. Le câlin, le gros plan `faux_aube`
(la bouche de Maman cousue de fil rouge ; une tache d'encre sur la route du Silence), puis le **faux générique**, mis
en page comme le vrai, bloqué sur « Mina ……… introuvable » :

- [Regarder] : le générique remonte à l'envers, la carte du chapitre 3 revient, et Noa, de lui-même : « Non. » … « C'est
  pas tout. » → Interlude III ;
- [Laisser défiler] : la non-fin **« Fin heureuse »** (« Merci d'avoir joué ! — Dodo », titre au point de croix et un
  seul « Continuer », qui ramène à la ligne bloquée avec un « introuvable » de plus) ; au troisième passage, seul
  [Regarder] reste. Jamais enregistrée comme une fin.

Sauvegarde automatique au début ; une sauvegarde 1.1 prise dans l'ancien final se réveille ici.

## Interlude III — « Le sac », 4 h 06 (v2, nouveau — bible § 2.3, § 3.10 ; `real-nuit.ts`)

Il fait encore nuit. Le narrateur se trompe (« Dodo. Ton mouton. » … « …Le mouton de Mina. ») ; le ventre de Dodo
grésille (« …nne nuit, N… »). Le fil « Mina 🐑 » s'ouvre enfin : un « bonne nuit » par soir pendant des mois, la
réponse d'une inconnue (« S'il vous plaît, arrêtez. »), une réponse possible (`i3_reply` : `pardon`, `bonnenuit`,
`rien`), puis le **journal d'appels** : « Mina 🐑 — entrant — 3:14 — 0:41 ». La photo se retourne à la troisième
tentative (`photo_decoupee`). La porte s'ouvre seule ; dans le placard de l'entrée, le sac de l'hôpital et le polaroïd
`polaroid_dodo` : « Noa prête Dodo à Mina. "Il veillera sur toi." » (T2). « Tu vois ? Tu reviens toujours. » →
chapitre 4.

## Chapitre 4 — « La Maison Cousue » (v2, nouveau — bible § 2.4, § 2.5, § 3.11 ; `chapter4.ts`)

L'appartement en maison de poupée, façade ouverte, sur une page de cahier de maths. Deux couches, que l'horloge à
coucou fait alterner : le **feutre** (`maison_feutre`, la maison « en mieux » cousue par Dodo) et le **stylo**
(`maison_stylo`, les quarante et une nuits seul, au stylo bille). Dodo maigrit et perd son coton ; **Mina n°366**, en
feutre, aux yeux-boutons, suit Noa et l'aide au combat en version cousue.

1. La porte se coud derrière Noa ; le **dîner en boucle** et la **Poupée-Maman** (« merci », ou « reste » : `c4_reste`).
2. Les nuits au stylo, 1, 9, 22 (la Clé, la trappe du grenier) et 35 (Noa prend la vraie veilleuse) ; le téléphone
   mural sonne chaque nuit. En option, nourrir Dodo du coton des moutons-poupées (`c4_coton`, les Bourres s'en
   souviennent au chapitre 6).
3. Le **grenier** (T3) : les mannequins des Mina ratées et leurs étiquettes (« Mina n°365 — ce soir. A failli finir sa
   phrase. »), le tas de couronnes, les bâtons sur les poutres ; **La Couseuse** (mot spécial « découdre »).
4. Le **couloir des coups** : on répond au code à travers le mur ; le couloir s'allonge quand la lumière tremble.
5. **Nuit 42 sur 41** (T4) : « Elle réclame sa veilleuse 🙂 », la lumière sous la porte, l'ombre d'une main ; **Le
   Petit Homme de la Maison** (mot spécial « rendre ») : épargné, « J'avais peur du noir. Moi. Pas elle. » ; vaincu,
   la veilleuse se fêle (`c4_fele`). Mina n°366 se défait en un long fil rouge ; souvenir 4 `souvenir_lumiere`.

## Interlude IV — « Le placard », 4 h 44 (v2, nouveau — bible § 2.6, § 3.12 ; `real-nuit.ts`)

L'armoire ouverte : les quarante et un mots du frigo gardés dans une boîte à chaussures, la boîte de la veilleuse
(« Pour Noa, 4 ans — pour les monstres du placard »), le thermomètre (« MEM 38,4 »). Sous la hotte, le dos du mot du
frigo : « Je sais que t— ». La chambre de Maman (`chambre_maman`) : le réveil réglé sur 5 h et son post-it (T5),
[Prendre la pile ?] (`i4_pile`), le dessin « MAMAN TU DIS PAS A NOA. PROMIS. » (`dessin_chut`), le découd-vite, le kit
« Mon doudou qui parle ! » et le mot de Nadia sur les piles. De retour dans la chambre, un coup dans le mur de Mina :
[Répondre] (un, deux ou trois coups, dans la scène de comptage) ou [Ne rien faire] (`i4_knock`, lu au combat final).
Dodo décousu, du coton sous les ongles → chapitre 5.

## Chapitre 5 — « La Marée Blanche » (v2, nouveau — bible § 2.7, § 3.13 ; `chapter5.ts`)

Trop clair, puis stérile. Pas de Mina dans l'équipe (son cadre vide reste) ; le fil rouge de Mina n°366 sert de chemin
sûr.

1. La **plage** surexposée (`plage`) : pas d'ombre, quarante et un coquillages (certains rejouent une nuit d'hôpital)
   et un quarante-deuxième caché ; **Mina d'avant**, au crayon, et son château.
2. **La serviette** : elle s'endort et ne se réveille pas pendant 30 secondes réelles (5 avec le mode Histoire ou
   « Réduire les attentes ») ; la seule réplique de Noa : « T'es nulle, tu dors tout le temps. » ; la marée blanche
   laisse un drap d'hôpital plat et vide.
3. Le portail du Thermomètre, « Tu vas bien ? » : [Oui] (`c5_menti`) ou [Non. J'ai de la fièvre.] (`c5_fievre`, le
   chemin long). Le **sas** (`sas`) : la porte suivante ne s'ouvre que si l'on ferme celle de derrière.
4. Le **lac blanc** (`lac_blanc`) : la neige blesse ; « Corriger les dessins » (Dodo tend le crayon : « Dessine-toi
   dedans. », `c5_corrige`) ; la salle des parents, entendue à travers la cloison (T6).
5. La **chambre de verre** (`chambre_verre`) : la visite, une partie de dessin à deux que la toux interrompt
   (`src/game/scenes/drawtogether.ts`) ; **La Vitre** (Tristesse, puis « je ne sais pas » ; d'abord « pardon » si
   `c5_menti`) ; souvenir 5 `souvenir_vitre`.
6. **La chute** : Dodo ouvre sa propre couture et Noa tombe dedans, sans réveil.

## Chapitre 6 — « Le Ventre de Dodo » (v2, nouveau — bible § 2.8 à § 2.10, § 3.14 ; `chapter6.ts`, `final-v2.ts`)

L'intérieur de la peluche : coton humide, passerelles de fil rouge, épingles, et au cœur un module vocal grand comme
une cathédrale, dont la pile fuit.

1. La **couture** (`couture`) : les murs rejouent le prologue ; **T7** : le nom passe de DODO à NOA, Noa finit lui-même
   la phrase de la pile ; « Je suis ce que tu fais avec sa voix. » Dès lors, le narrateur a le bip de Noa et dit vrai.
2. La **ouate** (`ouate`) : les bocaux des nuits 1 à 364 et le bocal sans étiquette de la nuit 0 ; les Bourres si
   `c4_coton` > 0.
3. La **boîte à musique** (`boite_a_musique`) : remettre trois dents de lait sur le peigne (scène de comptage, habillage
   « dents ») ; la berceuse joue en entier pour la première fois.
4. Le **couloir des 41 portes** (`couloir_41`, T8) : les deux versions de l'appel, une par branche, puis « Laquelle est
   vraie ? » ([La douce] / [La dure] / [Je ne sais pas], `G.meta.callVersion`) ; les yeux-boutons s'ouvrent sur 3 h 38 ;
   la **Pile** (rencontre unique, `c6_pile`).
5. Le **seuil de la voix** (`voix`, T9) : la Petite au Bonnet ; le carnet s'ouvre hors combat (« regarder », « fermer
   les yeux », « partir »).
6. **Le combat final contre Dodo**, en quatre phases : les moutons (un par défaite du joueur), DORMIR (les mots de
   l'appel, les couleurs qui mentent), les coups (répondre au code dans le noir ; `i4_knock`), les mots de Mina (avec le
   Bouton doré et la Pile chargée) ; ÉPARGNER devient OUVRIR LES YEUX. [Ouvrir les yeux] → le final ; [Rester] →
   *Beaux rêves* ; la route de l'Encre → *Silence*.

## Final — « Le carnet » (fil RÉEL, `chambre` → `appartement` → `chambre_mina`)

> **v2 (réécrit, bible § 2.11, § 3.15 ; `real.ts`)** — 5 h 52, le ciel pâlit (`appartement_aube`). Le téléphone
> (Maman : « Je rentre. » ; l'inconnue si `i3_reply` = `pardon`) ; le tiroir enfin ouvert (la clé de la chambre de
> Mina et les petits visages découpés : [Remettre ton visage sur la photo ?]) ; Noa prend sa veilleuse, frappe trois
> coups à la porte de Mina, trois coups répondent. Dans la chambre : le bonnet sur l'oreiller, la peinture usée à
> hauteur d'oreiller, le radiateur ; le carnet relu (« Elle savait. Elle a toujours su qui avait peur du noir. »), le
> poème, la veilleuse branchée à côté du lit de Mina (« Le geste que tu n'as pas fait. »). Maman rentre : « Je
> l'avais. La veilleuse. », la coda « Je savais », l'appel de 3 h 14 et le rhume (« ça pouvait venir de partout »),
> « Elle n'était pas dans le noir. », puis les réponses aux messages (ci-dessous) ; le radiateur cogne trois fois :
> « C'est le chauffage. » — « …Je sais. » Le final se ferme sur l'*Aube*, l'*Aube blanche* ou la fin secrète (voir
> « Les fins »). Les étapes ci-dessous sont celles de la v1.1.

1. Noa se réveille. Il ne pleut plus. Il fait encore nuit, mais le ciel pâlit. La peluche Dodo est sur le lit, tête
   tournée vers la porte.
2. La porte de Mina est **ouverte**. Sa chambre (`chambre_mina`) : dessins, lit, jouets, poussière, et sur le bureau
   le **carnet**. Examiner les objets (souvenirs doux, pas d'horreur).
3. **Le carnet** : `d.image('carnet_couverture')`, puis `carnet_page1..4` (la dernière : « Si tu as peur du noir,
   regarde la lune. Moi je serai ta veilleuse. — Mina »).
4. **Poème** (style DDLC) : `PoemScene.write('Pour Mina')` puis afficher `composePoem(mots)` sur papier.
   Le poème est gardé : `fin_poem` (pour l'épilogue) et `G.meta.poems` (galerie de l'écran titre).
5. Bruit de clés : **Maman** rentre. Elle trouve Noa dans la chambre de Mina. Elle ne dit rien d'abord. Puis :
   « Tu es réveillé. » — `pose_hug`. Elle répond à ce que Noa a écrit (ou à son silence) : un mot sur les messages
   (« Je t'écris tous les soirs, tu sais. Même quand tu ne réponds pas. » / le « moi aussi » lu au vestiaire / « tu
   as le droit d'être en colère »…), le « oui » mensonger des pâtes, puis l'invitation qui reprend `i2_reply`
   (« Tu m'as répondu « d'accord », cette nuit. » / « Si tu veux faire demi-tour, on fera demi-tour. »…). « On lui
   apportera une veilleuse. Une neuve. » — « …Oui. » Le soleil se lève (`fin_aube`).
6. **Épilogue — « Une veilleuse neuve »** (voir plus bas), puis `finishGame(d, 'aube')`.

### Répondre à Maman (prologue, interludes I et II)

> **v2** — L'Interlude III ajoute une réponse au fil « Mina 🐑 » (`i3_reply` : « Pardon. C'était ma sœur. », « bonne
> nuit », ou rien), que le final et l'épilogue lisent pour l'inconnue. Le final v2 reprend les réponses à Maman
> ci-dessous après la coda.

Un seul mot par moment, choisi dans un petit carnet à côté du téléphone ; chaque réponse a une émotion (couleur,
forme si l'option d'accessibilité est active), plus « Ne rien répondre » (on peut changer d'avis en revenant au
téléphone). Le fil garde tout l'historique (le téléphone du final montre toute la conversation).

| Moment | Réponses (`id`) | Maman |
|---|---|---|
| Prologue `p_reply` | « ok » (`ok`), « Moi aussi. » (`aime`), « J'arrive pas à dormir. » (`dormir`), « Laisse-moi. » (`laisse`) | répond tout de suite (« Merci de répondre. », « Laisse la veilleuse allumée. Je rentre vite. ») ; à « Laisse-moi » elle commence à écrire, plusieurs fois, puis plus rien |
| Interlude I `i1_reply` | « Oui. » (`oui`), « C'était trop salé. » (`sale`, si `i1_ate`) / « Je vais essayer. » (`essayer`), « Pas faim. » (`faim`), « Arrête de demander. » (`arrete`) | « Même un yaourt. Pour me faire plaisir ? », « Pardon. Je m'inquiète, c'est tout. »… |
| Interlude II `i2_reply` | « D'accord. » (`accord`), « Je peux pas. » (`peux`), « Pardon. » (`pardon`), « Pourquoi faire ? » (`pourquoi`) | pas de réponse (3h33) ; elle y répond au final |

`rien` = « Ne rien répondre » ; un drapeau absent = téléphone jamais ouvert (compté comme un silence).

## Les fins (v2 — bible § 5 ; `endings.ts`)

| Fin | Comment | Ce qu'on voit | Écran titre ensuite |
|---|---|---|---|
| **Aube** | [Ouvrir les yeux] au ch. 6, hors route du Silence, moins de trois dessins corrigés (`c5_corrige` < 3) | le final, le soleil se lève (`fin_aube`), l'épilogue | l'aube |
| **Aube blanche** | [Ouvrir les yeux] avec `c5_corrige` ≥ 3 | le poème ajoute tout seul « j'étais là », Maman ment pour lui (« …Oui. Oui, mon grand. »), un soleil de correcteur ; l'épilogue en blanc ; carte d'aide | l'aube au soleil blanc |
| **Beaux rêves** | [Rester] au ch. 6 | les années passent derrière sa porte, les mots de Maman s'empilent, la pile meurt sur « beaux rê— » : un garçon vivant, toujours dans sa chambre ; carte d'aide | « Continuer » seul, les jours réels comptés ; il ramène au chapitre 1 |
| **Silence** | la route de l'Encre (`isSilenceRoute()`) | il se réveille reposé ; la porte de Mina devient « DÉBARRAS », « Qui ? », trois coups dans le débarras et personne ne bouge ; son prénom devient « ______ » ; carte d'aide | la photo de famille, un blanc en forme d'enfant |
| **Veilleuse** (secrète) | une *Aube* déjà vue, le Bouton doré gardé, « J'ai de la fièvre », `c5_corrige` < 3, la Pile épargnée, « Je ne sais pas » à la question de l'appel, la pile du réveil prise | au final, [Découdre Dodo ?] : le module, le dessin `lune_finie`, les deux pistes ; Dodo recousu au fil bleu, laissé sur la pierre ; il ne parle plus jamais (`meta.dodoSilent`) | la veilleuse branchée à l'aube |
| *« Fin heureuse »* (non-fin) | [Laisser défiler] le faux générique | voir la fausse aube ; jamais enregistrée | le point de croix |

Chaque fin passe par `finishGame` (`common.ts`) : le générique, la carte d'aide 3114 après *Beaux rêves*, *Silence* et
*Aube blanche*, une nuit de plus dans la mémoire (`meta.nuits`). Le bonus s'ouvre après l'une des trois aubes.

## Épilogue — « Une veilleuse neuve » (fil RÉEL, route de l'aube, `bazar` → `jardin`)

> **v2 (retouché, bible § 3.16 ; `epilogue.ts`)** — Dodo est muet (« La pile est morte. », « Il ne dit plus rien. Tu
> le prends quand même. ») ; la voix off de la fin garde le nom de Dodo, avec le bip de Noa ; le 42ᵉ coquillage, s'il
> a été trouvé, est posé sur la pierre ; l'inconnue, au portail, si `i3_reply` = `pardon` : « Bonne journée. »
> Variantes : *Aube blanche* (« Je venais tous les jours. », Maman ne le contredit pas, « Beaux rêves, {player}. ») et
> *Veilleuse* (Dodo recousu laissé sur la pierre, les dessins de Mina au lieu de la voix off).

Le matin, un an jour pour jour. Monde réel de jour, musique `room_quiet`, aucun combat, 5–8 minutes. Tout est piloté
par des scripts de carte et des drapeaux `ep_*`, pour qu'une sauvegarde de suspension reprenne proprement.

1. Noir : « Plus tard, ce matin-là. », carte de titre « Épilogue — Une veilleuse neuve ». « Tu as mis Dodo dans ton
   sac. Tu ne sais pas trop pourquoi. »
2. **Le Petit Bazar** (`bazar`) : la vendeuse, Maman devant la vitrine (« Choisis, toi. C'est toi qui sais. »).
   Objets à examiner (cartes postales de la plage aux quarante-deux coquillages, parapluie jaune à canards, tasses à
   prénoms sans « Mina », boule à neige au mouton…). Sur la grande table, cinq veilleuses : **lune** (la même que
   celle de Mina), **étoile**, **mouton**, **nuage**, **couronne** → `ep_vl`, réaction de Maman.
3. **Le comptoir** : « C'est pour offrir ? » — Noa peut dire « C'est pour ma sœur. » (il ne le dit plus depuis un an)
   ou se taire. La vendeuse se souvient de « la petite rousse qui voulait le parapluie à canards » ; elle comprend
   sans qu'on le dise. Papier de soie, ruban jaune, deux bonbons à la fraise : « Un pour toi. Un pour elle. » →
   `ep_paid`, la sortie s'ouvre.
4. **Le jardin** (`jardin`) : Maman suit Noa (« C'est tout au fond. Sous le grand arbre. »). Tombes à lire, moineaux,
   robinet et arrosoir (optionnel : `ep_water`, arroser les fleurs de Mina → `ep_watered`). Au coin du grand arbre,
   Maman s'arrête : « Vas-y, toi. Je reste là. » (`ep_maman_wait`).
5. **La pierre de Mina** (petite, blanche, une étoile gravée, sa couronne en papier) : « … Salut, Mina. » Noa pose la
   veilleuse (`ep_placed` ; « En plein jour, on la voit à peine. Mais elle brille. »), puis **lit à voix haute** le
   poème de la nuit (`fin_poem`, mot à mot) → `ep_poem`.
6. **Dodo** : Noa l'assoit sur la pierre. Il ne dit rien ; ses yeux-boutons attrapent la lumière (♥). Le laisser à
   Mina (« Veille sur elle, maintenant. ») ou le garder → `ep_dodo` = `laisse` | `garde`.
7. Maman s'approche : « Elle l'aurait accroché sur le frigo. Avec l'aimant en forme de fraise. » Puis, quand le
   joueur le décide (parler à Maman, ou le portail) : « On rentre ? Ce soir, je fais des pâtes. » (si `i1_reply` =
   `sale` : « … Pas trop salées. ») Maman tend la main. Illustration `fin_jardin`.
8. Dernières lignes, voix de Dodo : « Je veillerai sur lui. Pour de vrai, cette fois. » (ou, s'il est resté :
   « Je veillerai sur elle. Lui, il n'a plus peur du noir. Plus autant. ») « Merci, {player}. Bonne nuit. Et
   bonjour. » → `finishGame(d, 'aube')`.

## Bonus — « Les rêves des autres » : la nuit de Maman (après une fin de l'aube)

> **v2 (retouché, bible § 3.17)** — Devant la porte de Noa, Maman s'arrête toujours : « Il dort. Enfin. Cinq heures,
> ça ira. » ; un nouveau souvenir, 3 h 38 dans la chambre de Noa (elle débranche la veilleuse et voit ses paupières
> trembler : [Le réveiller] / [Le laisser dormir], et dans les deux cas « Tu l'as laissé faire semblant. ») ; le
> Réveil : « Tu m'as remonté pour avoir le droit de le laisser dormir. » ; Nadia : « Vous lui en parlerez ? » —
> « …Un jour. » ; Mina dans le fauteuil : « Le téléphone, c'est moi qui ai demandé à Nadia. », « Tu lui as dit que
> j'allais mieux. Merci. » Le bonus n'écrase jamais la sauvegarde de la partie principale.

Entrée de l'écran titre débloquée par l'une des trois aubes, `aube`, `aube_blanche` ou `veilleuse` (`bonusUnlocked`,
`flow.startBonus` → `story/bonus.ts`, partie séparée qui ne
touche pas aux drapeaux de l'histoire principale, `flags.bonus`). Le joueur incarne **Maman**
(`G.state.playerChar = 'maman'`, « MAMAN » dans le combat, stylo quatre couleurs et gilet de laine). 15–25 minutes.
Cartes `src/data/maps/bonus.ts`, drapeaux `b_*`.

**Ce que Maman porte.** Elle travaille de nuit comme aide-soignante aux Glycines, une maison de retraite, « pour ne
pas penser ». Pendant les dernières semaines de Mina, elle a dormi **quarante et une nuits** dans le fauteuil des
parents de la chambre 304. Le dernier soir, Mina a demandé sa veilleuse ; Noa ne l'a pas apportée. L'infirmière de nuit
(Nadia) a dit à Maman de rentrer dormir — « Elle est calme, ce soir. Je reste avec elle. » Maman est rentrée, a
remonté son vieux réveil sur **cinq heures** pour rapporter la veilleuse avant que Mina se réveille. Le réveil n'a
jamais sonné : le téléphone a sonné avant, à **3 h 33**. Elle a posé la veilleuse sur la table de chevet, sans la
brancher (« elle n'a jamais été branchée », ch. 3), puis l'a rapportée à la maison, le fil enroulé (final). Depuis,
elle ne dort plus la nuit.

1. **3 h 33, salle de pause** (noir). La messagerie de Noa (l'annonce d'il y a deux ans : Mina veut faire le bip
   elle-même), puis **le message vocal de l'interlude II, mot pour mot**. « Tu fermes les yeux. Juste une seconde. »
   Carte « Les rêves des autres — La nuit de Maman ».
2. **Les Glycines, service de nuit** (`b_service`, couloir de papier). Son vieux réveil est vivant : **le Réveil**,
   pendant de Dodo (gentil, efficace, puis possessif) — « Debout ! Tu ne dors jamais, c'est pour ça qu'on s'entend
   si bien. » Il saute dans sa poche. Casier (photo de la plage), machine à café, téléphone (rappeler juste pour
   entendre l'annonce), chambres 10 à 16 (Monsieur Paul, Madame Rose et l'heure, Madame Odette et sa main — « tu l'as
   fait quarante et une nuits »), une **porte 304** qui n'existe pas aux Glycines et dont la lumière d'appel reste
   allumée. PNJ : **Sabine** (collègue : un bonbon, « Ton grand, ça va ? », « Assieds-toi cinq minutes, je te
   couvre »), **M. Albert** (insomniaque en fauteuil : « la nuit, c'est fait pour poser les choses », « le grand et la
   petite »). Ennemis : **Sonnette**, **Café Serré**. **Boucle** : au bout du couloir, la porte de chez elle ; on n'y
   arrive jamais (retour au début, sonnettes plus fortes, `b_loop`). La sortie : **s'asseoir cinq minutes sur le
   banc** (`b_sat`) — le Réveil hurle, elle pose la main dessus, les sonnettes se taisent une à une, la porte de
   chez elle s'entrouvre.
3. **À la maison** (`b_appart`, aspect monde réel, `maman@real`). « Chut. Tu vas réveiller Noa. » La porte de Noa,
   de la lumière dessous (frapper : pas de réponse, la main à plat sur la porte), le mot du frigo (quoi qu'elle
   commence — « Mange quelque chose. », « Pardon. », « Je t'aime. » — le mot final est celui que Noa lit à
   l'interlude I), les pâtes, la photo du parc, la chaise de Mina. Devant la porte de Mina : **le Panier** de linge
   (combat ; besoin : JOIE ×2 puis le mot **« plier »**, ou « garder » ; épargné → le pyjama à étoiles plié sur son
   oreiller). La pancarte : « DÉFENSE D'ENTRER (sauf Noa) » — « et Maman pour les câlins ». Derrière la porte de Mina
   : un couloir d'hôpital.
4. **Pédiatrie, troisième étage** (`b_hopital`, l'hôpital de papier un an plus tôt). Le « chocolat du robot » (B4),
   les dessins de Mina, la salle des parents (« Il ne veut pas venir », dit tout bas), Gérard la plante. **Mina, à
   3 heures du matin** (souvenir) : « On fait la course jusqu'au robot ? … Porte-moi, j'ai les jambes en coton. » —
   « Toi aussi tu devrais dormir. Tu dis que tu dors, mais t'as toujours les yeux ouverts. » Point de sauvegarde (la
   veilleuse de couloir ; ne remplace jamais une partie principale en cours). **Nadia**, devant la 304 : « Ce soir-là,
   c'est moi qui vous ai dit de rentrer dormir. Vous m'en voulez ? » — « Non. Pas à vous. » — « …À qui, alors ? »
5. **Chambre 304** (`b_304`). « Tu y as dormi quarante et une nuits. Quarante et une. Pas quarante-deux. » Le Réveil :
   « Je n'ai jamais sonné. Le téléphone a sonné avant moi. Alors maintenant, je sonne. Tout le temps. »
   **Boss : le Réveil** (fond hôpital, musique `reveil`, ne peut pas être vaincu par la force : FRAPPER = appuyer sur
   le bouton du dessus, cinq minutes de silence, puis DRIIING).
   - Phase 1 : il parle (« Chaque minute où tu ne fais rien, quelqu'un a besoin de toi… Un fils. » — « Et s'il
     t'appelle, une nuit ? Et si tu dors ? »). Les mots glissent sur le cadran.
   - Phase 2 : il sonne (`b_reveil_sonne`, bord rouge qui pulse) ; OBJET, FRAPPER puis ÉPARGNER deviennent
     **DEBOUT** (se relever : quelques PV, mais le tic-tac accélère et les attaques durcissent ; à la fin, tenir coûte
     des PV). Le carnet ne contient que ses mots : debout, encore, vite, ça va, tiens bon, plus tard.
   - Phase 3 : son téléphone vibre dans sa poche. Le carnet montre **ses propres mots, ceux qu'elle écrit à Noa
     chaque soir** — « repose-toi », « pleure », « pas ta faute » (doux-amer), « pardonne-toi », « je t'aime »,
     « rentre » — à écrire, pour une fois, pour elle. Chacun fissure le cadran (`b_reveil_fele`), ralentit la musique,
     fait revenir un souvenir (« Maman, tu fais dodo avec moi ? »). Après quatre mots, un bouton devient **DORMIR**
     (le miroir de Dodo : pour Noa, dormir était le piège ; pour Maman, c'est la guérison). « Alors on m'appellera. Et
     je me réveillerai. C'est tout. »
   - Pas de game over dans ce rêve : à 0 PV, un réveil sonne et Maman se relève (« Tu te relèves toujours »).
6. **Elle dort.** Le Réveil face contre le bois. Dans le fauteuil, Mina veille sur elle : « T'étais pas là, le dernier
   soir. Je sais. Mais t'étais là tous les autres. Quarante et un. Je les ai comptés, moi aussi. » — Nadia lui a tenu
   la main, la porte était entrouverte, « je voulais que tu dormes » ; la veilleuse au fil enroulé, « un jour,
   quelqu'un va la rebrancher » (Noa, au final) ; « Noa a peur, comme toi : vous fermez les portes. Frappe quand
   même. » — « Dors. Moi, je veille. »
7. **Cinq heures cinquante** (illustration `maman_aube`, galerie). Sabine l'a laissée dormir deux heures. Elle écrit
   à Noa (brouillons effacés : « Pardon. », « Tu dors ? ») : **« Je rentre. »** — le message de 5 h 52 du final. Le
   statut passe à **« Lu »** : il ne dort pas. Des clés dans la serrure : « Noa ? Tu es réveillé ? » — la première
   réplique de Maman au final. Crédits, titre ; `G.meta.bonusDone = true` (aucune fin enregistrée).
