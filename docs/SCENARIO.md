# Scénario détaillé — VEILLEUSE

> Document de référence pour l'écriture des scènes. Il fixe la **structure**, les **révélations** et les **arcs**
> pour que les quatre fils (réel, chapitres 1 à 3) restent cohérents. Les dialogues exacts sont écrits dans le code ;
> les répliques citées ici sont des exemples de ton, à reprendre ou améliorer.

## Arcs à tenir sur toute la durée

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
5. **Village des Moutons** (`village`) : PNJ moutons drôles (un qui compte les autres pour s'endormir, un poète,
   un qui a peur de son ombre, un agneau qui a perdu son **ballon rouge** — quête annexe : le ballon est coincé dans
   un arbre de la prairie, récompense `crayon de cire` = arme `cire`), **Madame Lune** (endormie, parle en bâillant,
   sibylline : « Tout le monde finit par se réveiller… ou presque. »), elle donne la **Veilleuse de poche** si on lui
   parle deux fois (« Pour ceux qui ont peur du noir. »). **Boutique de Chaussette** (`boutique`) : marchande
   joviale à qui il manque sa paire. **Maison d'un mouton** (`maison_mouton`) : intérieur cosy, un lit où l'on peut
   faire une sieste (soin) ; on peut y trouver le `plaid` ? (non : garder `plaid` pour le ch. 2).
   Mina commente beaucoup de choses (tableau d'affichage avec **ses** dessins : « C'est moi qui les ai faits ! …
   Enfin je crois. »).
6. **Chaussette Perdue** (ennemi visible, route du village) : mot spécial « paire ». Si épargnée → elle retrouve la
   marchande ; flag `c1_chaussette_paire` ; Chaussette offre une réduction / un cadeau.
7. **Colline aux Couvertures** (`colline`) : sol en courtepointe, oreillers géants, petite énigme (pousser /
   contourner des oreillers ou trouver un chemin dans un labyrinthe de couvertures), ennemis. Avant le sommet,
   point de sauvegarde. Mina : « Les monstres sous le lit, ceux dans le placard… j'avais peur d'eux. Avant. »
8. **Boss : le Monstre du Placard** (armoire seule au sommet). Il a peur du noir lui aussi. Hooks : au tour 2 ou 3
   Mina s'écrie : « Noa ! Il a peur du noir, lui aussi ! » ; utiliser la **Veilleuse de poche** (OBJET) le rend
   apaisable d'un coup (ou compte comme 2 mots), sinon 4 mots de JOIE. Épargné → il devient `npc_placard` gentil
   (flag `c1_placard_spared`). Vaincu → il fond en encre, Mina se tait : « …Il voulait juste de la lumière. »
9. **Pas d'étoile**, mais un **souvenir** : `d.souvenir('fenetre')` + `d.image('souvenir_fenetre', …)`. Noa a mal
   à la tête, flash blanc, bip lointain d'hôpital. Mina : « Noa ? Ça va ? Tu fais une drôle de tête. » Dodo apparaît :
   « C'est l'heure de se réveiller… pour l'instant. » → `wakeUp(d, 1)`.

## Interlude I — « Le frigo » (fil RÉEL, `chambre` + `appartement`)

Jour gris, pluie, lumière blafarde. Musique `interlude`.

1. Noa se réveille. Dodo est une peluche immobile. Le téléphone vibre : un message de Maman (« Tu as mangé ? »).
2. L'appartement s'ouvre (`appartement`) : couloir, salon (télé éteinte, canapé, photo), cuisine (frigo avec mot
   aimanté : « Noa, mange quelque chose s'il te plaît. Je t'aime. — Maman », et des dessins de Mina), salle de bain
   (miroir : « Tu évites ton reflet. »), chambre de Maman (fermée : « Elle n'est pas rentrée. »), **porte de Mina**
   (pancarte « CHAMBRE DE MINA — DÉFENSE D'ENTRER (sauf Noa) ») : « Tu poses la main sur la poignée. Tu ne peux
   pas. », porte d'entrée (« Dehors, il pleut. Tu n'as pas envie. »).
3. Manger (optionnel, cuisine) → `i1_ate`, soin, petite scène (pâtes froides, « C'est bon, en fait. »).
4. Retourner au lit → « Dormir ? » → `enterDream(d, 2)`.

## Chapitre 2 — « La Forêt de Crayons » (fil CH2)

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

Nuit plus noire que jamais. Musique quasi absente, `hum`. Glitches discrets.

1. L'horloge affiche **3:33**. Le téléphone : un **message vocal** de Maman : « Noa… ça fait un an demain. Je… je
   rentre ce soir. On ira la voir ensemble, d'accord ? »
2. `appartement_nuit` : même plan mais plus sombre (lumière limitée autour de Noa), la **télé s'allume seule** :
   vidéo de famille (`d.image('tv_mina')`, voix de Mina : « Noa ! Regarde ce que j'ai dessiné ! »), puis neige.
3. Le **couloir s'allonge** (téléportation silencieuse vers une version plus longue, ou portes qui se répètent).
4. La **peluche Dodo** est assise au milieu du couloir (elle était sur le lit). La porte de Mina est
   **entrouverte**, noir derrière : « Pas encore. » (on ne peut pas entrer).
5. De retour dans la chambre, Dodo (peluche) **parle dans le monde réel** pour la première fois : « Tu sais ce qui
   se passe quand on se réveille, {player} ? On perd tout. » `setPageTitle('Ne pars pas')`. Dormir →
   `enterDream(d, 3)`.

## Chapitre 3 — « L'Hôpital de Papier » (fil CH3)

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
6. **Combat final : Dodo** (`dodo_battle`, fond `void`) — Dodo ne peut pas être vaincu par la force (« On ne frappe
   pas le sommeil. »).
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

## Final — « Le carnet » (fil RÉEL, `chambre` → `appartement` → `chambre_mina`)

1. Noa se réveille. Il ne pleut plus. Il fait encore nuit, mais le ciel pâlit. La peluche Dodo est sur le lit, tête
   tournée vers la porte.
2. La porte de Mina est **ouverte**. Sa chambre (`chambre_mina`) : dessins, lit, jouets, poussière, et sur le bureau
   le **carnet**. Examiner les objets (souvenirs doux, pas d'horreur).
3. **Le carnet** : `d.image('carnet_couverture')`, puis `carnet_page1..4` (la dernière : « Si tu as peur du noir,
   regarde la lune. Moi je serai ta veilleuse. — Mina »).
4. **Poème** (style DDLC) : `PoemScene.write('Pour Mina')` puis afficher `composePoem(mots)` sur papier.
5. Bruit de clés : **Maman** rentre. Elle trouve Noa dans la chambre de Mina. Elle ne dit rien d'abord. Puis :
   « Tu es réveillé. » — `pose_hug`. « On ira la voir ensemble ? » — « …Oui. » (si `i1_ate` : « Tu as mangé les
   pâtes ? » petit sourire). Le soleil se lève (`fin_aube`).
6. Dernières lignes : Dodo, simple peluche, sur l'appui de fenêtre : « Je veillerai sur lui. Pour de vrai, cette
   fois. Merci, {player}. » → `finishGame(d, 'aube')`.
