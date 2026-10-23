# Liste de contrôle des indices

Chaque indice que la bible (`docs/HISTOIRE.md`, § 2.2 à § 2.11, § 3.3, § 3.5, § 3.7, § 3.8, § 4 « Monde réel », § 5) place
dans le monde réel : prologue, interludes I à IV, fausse aube, final, épilogue, bonus et mémoire méta. Pour chacun :
où il se trouve dans le jeu (fichier:ligne au moment du lot 6, identifiant d'entité pour le bot) et le scénario du bot
qui le prouve (`tools/scenarios/`). Les indices des chapitres 1 à 3 (lots 7 et 8) suivent, après ceux des interludes
III et IV.

Tous les indices des lots 6 et 2 s'atteignent comme un joueur les atteint (marcher jusqu'à l'objet et appuyer sur A) :
Dodo s'examine depuis le côté du lit (depuis le bas, c'est le lit), le mur contre le lit répond au pied du lit
(`mur` / `n_mur`), le calendrier est accroché près de la fenêtre (`calendrier` / `n_calendrier`).

## Prologue — « Il fait nuit » (§ 3.3)

| Twist | Indice | Où | Entité / code | Preuve |
|---|---|---|---|---|
| T2 | « Dodo. Le mouton en peluche de Mina. Elle te l'a donné, avant. » et « Mina m'a donné à toi. » gardés mot pour mot | Réveil de Dodo | `bed` → `prologueDodo`, `src/game/story/real.ts:588`, `:596` | `lot6-prologue` |
| T4 | Veilleuse, 2ᵉ examen : « Elle a toujours été là, sur ta table de nuit. …Non ? » | Table de nuit | `veilleuse`, `real.ts:576` | `lot6-prologue` |
| T4 | Armoire : « Tu n'aimes pas la laisser ouverte la nuit. » (existant) ; 2ᵉ examen : « Avant elle, quelqu'un d'autre le disait. » | Armoire | `armoire`, `real.ts:705`, `:702` | `lot6-prologue` |
| T4 | Réponse « J'arrive pas à dormir » : « Laisse la veilleuse allumée. Je rentre vite. » (existant) | Téléphone, fil de Maman | `phone`, `real.ts:104` | `lot6-prologue` |
| T6 | Calendrier : pas tourné depuis un an, « visite ? » entouré puis raturé, plus loin « elle va mieux !! » | Mur près de la fenêtre | `calendrier`, `real.ts:729`, carte `src/data/maps/real.ts:161` | `lot6-prologue` |
| T8 | Casque : « Le fil est enroulé si serré qu'il a coupé le plastique. » | Sur les livres du bureau | sprite `prop_casque` (`maps/real.ts:163`), texte au 1ᵉʳ examen du bureau `bureau`, `real.ts:635` | `lot6-prologue` |
| T8 | Tiroir du bureau : « Tu sais ce qu'il y a dedans. Non. Tu ne sais pas. » | Bureau, 2ᵉ examen | `bureau`, `real.ts:640` | `lot6-prologue` |
| T8 | Fil épinglé « Mina 🐑 » verrouillé : « Tu ne l'ouvres pas. Pas ce soir. » | Téléphone, liste des contacts | `phone` → `homePhone`, `contactsAt`, `real.ts:291`, `:299` | `lot6-prologue` |
| T8 | Réponse « Laisse-moi. » (existant, preuve de la version dure) | Téléphone | `real.ts:105` | `v11-prologue` |
| — | Le mur contre le lit : « Tu as poussé ton lit contre ce mur. De l'autre côté, c'est sa chambre. » ; la peinture plus claire à hauteur d'oreiller et le tuyau du radiateur (double ordinaire des coups) | Pied du lit, mur de gauche ; tache sur le mur au-dessus du lit | `mur` (`maps/real.ts:160`), sprite `prop_mur_use`, `real.ts:745`, `:750` ; le lit le nomme aussi, `real.ts:458` | `lot6-prologue` |
| T7 | Dodo avant son réveil : « Une couture rouge sur le ventre, à gros points. Quand tu appuies, ça craque. » | Dodo, depuis le côté du lit | `dodo_plush` → `plush`, `real.ts:505` ; couture rouge sur le sprite `DODO_PLUSH`, `src/data/sprites/props.ts:494` | `lot6-prologue` |
| T7 | « Son dos est pelé par endroits. Comme rongé. » | Même examen | `real.ts:506` | `lot6-prologue` |
| — | La photo face contre le sol, 2ᵉ examen : une rognure de papier glacé, « Bleue d'un côté » (le visage découpé de l'Interlude III) | Sol, au milieu de la chambre | `photo`, `real.ts:759` | `lot6-prologue` |
| T7 | Le bip de Dodo est celui de Noa, une octave plus haut (dès le prologue) | Toutes les répliques de Dodo | `VOICES.dodo`, `src/engine/audio.ts:190` | écoute |
| § 5 | Nouvelle partie+ (une fin v2 en mémoire) : « Tu reviens. Tu sais, toi. … Tu ne lui diras rien, hein ? » | Réveil de Dodo | `sawV2Ending()`, `real.ts:604` | `lot6-ngplus` |
| § 5 | `G.meta.dodoSilent` : Dodo ne s'éveille pas, « REGARDE SOUS LE LIT » est un dessin de Mina scotché au-dessus du lit, Noa glisse sous le lit seul | Lit, dessin | `bedAlone`, `huntDrawing`, `real.ts:534`, `:556` ; `dessin_chasse` (`maps/real.ts:159`, sprite `DESSIN_CHASSE`) | `lot6-seul` |

## Interlude I — « Le frigo » (§ 3.5)

| Twist | Indice | Où | Entité / code | Preuve |
|---|---|---|---|---|
| T2 | Seconde photo dans le couloir : un petit garçon serre un mouton blanc plus gros que lui ; « Tu ne te souviens pas de cette photo. » | Mur du couloir, à gauche de la porte de Mina | `a_photo_bebe` (`maps/real.ts:221`), `babyPhoto`, `real.ts:825`, `:828` | `lot6-interlude1` |
| T2 | Dodo déplacé (au pied du lit, tourné vers la porte), puis l'étiquette : « Sur l'étiquette, un prénom au feutre, presque effacé : N… » | Dodo, depuis le côté du lit | `dodo_plush` → `plush`, `real.ts:513`, `:521` | `lot6-interlude1` |
| T5 / coda | Dos du mot du frigo : raturé, illisible | Frigo, après la lecture du mot | `a_frigo`, `real.ts:867` | `lot6-interlude1` |
| T7 | Le tic : « Pas maintenant. Pour l'instant. » (Noa, au lit trop tôt) | Lit | `bed`, `real.ts:475` | `lot6-interlude1` |
| T6 | Calendrier de jour : « visite ? » raturé trois fois, « Tu ne sais plus pourquoi. » | Calendrier | `calendrier`, `real.ts:721` | `lot6-interlude1` |
| T5 | Porte de Maman, 2ᵉ examen : « Il n'y a pas de serrure. » | Couloir | `a_porte_maman`, `real.ts:954` | `lot6-interlude1` |
| — | Porte de Mina, 2ᵉ examen : « C'est fermé à clé, de toute façon. » (la clé est dans le tiroir, IV) | Couloir | `a_porte_mina`, `real.ts:918` | `lot6-interlude1` |
| T8 | Fil épinglé « Mina 🐑 » verrouillé : « Pas aujourd'hui. Pas en plein jour. » | Téléphone | `real.ts:300` | `lot6-interlude1` |

## Interlude II — « La porte », 3 h 33 (§ 3.7)

| Twist | Indice | Où | Entité / code | Preuve |
|---|---|---|---|---|
| — | En entrant dans le couloir : trois coups dans le mur de Mina, puis rien | Couloir (arrivée) | `appartNuitEnter`, `real.ts:996`, drapeau `i2_coups` | `lot6-interlude2` |
| T8 | Salle de bain : « Dans le miroir, ton reflet a les yeux fermés. » | Porte de la salle de bain, [Entrer] | `a_sdb`, `real.ts:938`, drapeau `i2_reflet` | `lot6-interlude2` |
| T9 | Une image de la vidéo saute : une petite fille en bonnet à oreilles de mouton, de dos ; puis la neige | Télé (`tvWakes`) | illustration `tv_mina` (`paintTvBonnet`, `src/data/illustrations.ts:1795`, cinq images toutes les dix secondes) ; réplique `real.ts:1017` | `lot6-interlude2` |
| T7 | Dodo dans le couloir : « Ses pattes sont propres. Le couloir est plein de poussière. » | Couloir | `dodo_corridor`, `real.ts:1039` | `lot6-interlude2` |
| T7 | Dodo parle dans le réel : son bip, sans portrait ; la peluche ne bouge pas, seul Noa est animé | Lit | `interlude2Dodo`, locuteur `dodoreel`, `real.ts:1065`–`:1070` | `lot6-interlude2` |
| T6 | Le fil de Maman se remonte d'un an : « Elle va un peu mieux ❤ », « Tu tousses encore ? Alors tu ne viens pas, d'accord ? », puis les messages du dernier soir (20 h 12, 20 h 15, 22 h 51) | Téléphone, après le message vocal | `mamanYear`, `readBack`, `real.ts:177`, `:327` ; défilement `PhoneScene.scrollToMessage` | `lot6-fil` |
| § 5 | Nouvelle partie+ (`meta.fauxGenerique`) : « Cette fois, tu sais que ça ne s'arrête pas au générique. » | Lit, Dodo | `real.ts:1068` | `lot6-interlude2` |
| — | L'horloge à 3 h 33 dont l'aiguille des secondes ne bouge plus (existant) | Horloge | `real.ts:691` | — |
| T5 | Porte de Maman : « Elle n'est toujours pas rentrée. » (existant) ; 2ᵉ examen « Il n'y a pas de serrure. » | Couloir | `a_porte_maman`, `real.ts:957`, `:954` | `lot6-interlude2` |

## Interludes III et IV (lot 2, `src/game/story/real-nuit.ts`)

| Twist | Indice | Où | Entité / code | Preuve |
|---|---|---|---|---|
| T2 | Le narrateur se trompe : « Dodo. Ton mouton. » … « …Le mouton de Mina. » | III, Dodo depuis le côté du lit | `dodo_plush` → `N.dodo`, `real-nuit.ts:190`, `:194` | `lot6-nuit` |
| T2 | Le polaroïd « Noa prête Dodo à Mina. "Il veillera sur toi." » | III, sac de l'hôpital | `sac`, `real-nuit.ts:847`, `:851` | `lot2-i3-*` |
| T7 | Le ventre de Dodo : « …nne nuit, N… », puis « Tu n'as rien entendu. » | III, Dodo | `real-nuit.ts:129`, `:206` | `lot6-nuit` |
| T8 | Journal d'appels : « Mina 🐑 — entrant — 3:14 — 0:41 », « Tu ne te souviens pas de cet appel. » | III, téléphone | `real-nuit.ts:369`, `:473`, `:475` | `lot2-i3-*` |
| T8 | L'inconnue : « S'il vous plaît, arrêtez. » | III, fil « Mina 🐑 » | `real-nuit.ts:286` | `lot2-i3-*` |
| — | La photo au visage découpé | III, photo | `real-nuit.ts:524` | `lot2-i3-*` |
| T4 | La boîte de la veilleuse : « Pour Noa, 4 ans — pour les monstres du placard » | IV, armoire | `n_boite_veilleuse`, `real-nuit.ts:1106` | `lot2-i4-*` |
| T5 | Le réveil sur 5 h et le post-it « 5h — veilleuse (chambre de Noa) » | IV, chambre de Maman | `reveil`, `real-nuit.ts:1252` | `lot2-i4-*` |
| T5 | Le dessin « MAMAN TU DIS PAS A NOA. PROMIS. » | IV, miroir | `m_miroir`, `real-nuit.ts:1285` | `lot2-i4-*` |
| T5 / coda | Le dos du mot du frigo : « Je sais que t— » | IV, frigo puis hotte | `t_frigo`, `gaziniere`, `real-nuit.ts:988` | `lot2-i4-*` |
| T6 | Le thermomètre : « MEM 38,4 » | IV, devant l'armoire | `n_thermometre`, `real-nuit.ts:1119` | `lot2-i4-*` |
| T6 | Calendrier : « elle va mieux !! » | IV, calendrier | `n_calendrier`, `real-nuit.ts:574` | `lot6-nuit` |
| T7 | Le kit vocal et le mot de Nadia : « ça tient environ un an » | IV, commode de Maman | `m_kit`, `real-nuit.ts:1324` | `lot2-i4-*` |
| T7 | Le tic « Pas maintenant. Pour l'instant. » | III et IV, lit | `real-nuit.ts:244`, `:253` | — |
| — | Coton sous les ongles, la couture du dos qui lâche | IV, Dodo | `real-nuit.ts:1199` | `lot2-i4-*` |
| — | La peinture usée à hauteur d'oreiller | III et IV, mur au pied du lit | `n_mur`, `real-nuit.ts:715` | `lot6-nuit` |

## Chapitre 1 — « Le Pays de Coton » (§ 3.4, lot 7)

L'acte I reste tendre : une seule fausse note par endroit, et chacune a son double ordinaire (une réplique de Mina, une
blague, une explication banale). Le chapitre ne dit jamais rien de l'appel. Tous les indices s'atteignent en marchant et
en appuyant sur A ; les scripts de debug `c1_tresor` (`&alone=1`), `c1_boutique`, `c1_frapper` et `c1_colline` posent
Noa à côté, avec Mina.

| Twist | Indice | Où | Entité / code | Preuve |
|---|---|---|---|---|
| T3 | Tête de lit gravée de bâtons « par paquets de cinq », « Tu arrêtes de compter à cent. » ; double : Mina, « compter les dodos jusqu'à Noël » | Prairie, le lit | `dream_bed` → `dreamBed`, `src/game/story/chapter1.ts:159` ; sprite `prop_bed_tally` (`src/data/sprites/props.ts:1610`, carte `src/data/maps/chapter1.ts:70`) | `lot7-prairie` |
| T3 | Traces de bottes : « C'est ta pointure. » ; Mina : « Un monstre qui a tes pieds ! » | Prairie, buisson | `buisson_bottes` → `bootsBush`, `chapter1.ts:176` | `lot7-prairie` |
| § 5 | Le Bouton doré, objet clé, donné par Mina : « C'est un bouton secret. Faut appuyer fort. », « Tu le gardes, hein ? Même si on te le demande. » (trouvé seul, Noa ne prend que le biscuit ; Mina le donne quand il revient avec elle) | Prairie, trésor de Mina | `tresor_mina` → `minaTreasure`, `minaButton`, `chapter1.ts:225` ; drapeau `c1_bouton`, objet `bouton_dore` (lu par `final-v2.ts`) | `lot7-prairie`, `lot7-tresor-seul` |
| — | La boîte de pellicule : « Mes dents de lait. La petite souris est jamais venue à l'hôpital. » | Prairie, trésor de Mina | `chapter1.ts:223` | `lot7-prairie` |
| T9 | Mina : « Mes couettes ? C'est de la laine, idiot. Ça repousse pas, la laine. » (3ᵉ réplique) | Prairie, parler à Mina | `MINA_LINES.prairie`, `chapter1.ts:1016` | `lot7-prairie` |
| T3 | Madame Lune, 1ʳᵉ réplique : « Encore t— … *bâille* … Bonsoir, toi. » | Village | `lune`, `chapter1.ts:258` | `lot7-village` |
| T4 | La Veilleuse de poche ; Mina, pour rire : « C'est toi le peureux. Tu dors avec MA veilleuse, de toute façon. » | Village, Madame Lune (2ᵉ fois) | `chapter1.ts:268` | `lot7-village` |
| T2 | Madame Lune, 3ᵉ réplique : « Il a beaucoup voyagé, ce mouton… Aller. Et retour. » | Village | `chapter1.ts:273` | `lot7-village` |
| T8 | Madame Lune : « Il y en a un qui fait semblant. Il respire trop fort. » ; double : Mina, « C'est pas moi ! …Enfin, des fois. » | Village (4ᵉ fois, puis une fois sur quatre) | `chapter1.ts:281` | `lot7-village` |
| T3 | Le mouton compteur : « …trois cent soixante-quatre… Oh ! Tu me fais perdre le compte. À chaque fois. » | Village | `compteur` → `moutonCompteur`, `chapter1.ts:314` | `lot7-village` |
| T2 | « Ton mouton, il a changé de maison, non ? Il sent l'hôpital. Et la lessive de chez toi. » | Village, le compteur (3ᵉ fois) | `chapter1.ts:319` | `lot7-village` |
| — | Humour noir : « si un jour je disparais, quelqu'un le remarquera » ; Mina : « T'es le seul mouton qui compte. » | Village, le compteur (4ᵉ fois) | `chapter1.ts:323` | `lot7-village` |
| T3 | Le mouton borgne : « C'est Dodo qui me l'a emprunté. Il en avait besoin pour quelqu'un. » ; double : la poupée de Mina, un bouton recousu à la place | Village, au bord de la mare | `borgne` → `moutonBorgne`, `chapter1.ts:347` ; perso `mouton_borgne` (`src/data/sprites/characters.ts:579`, carte `maps/chapter1.ts:215`) | `lot7-village` |
| T3 | Le banc « M + N » : Mina ne se souvient pas de l'avoir gravé (existant) ; « Le M a une petite boucle, en haut. Tu fais tes M comme ça, toi aussi. » (le bocal de la nuit 40, ch. 6) | Village, banc | `banc_mn` → `benchMN`, `chapter1.ts:411` | `lot7-village` |
| § 1.1 | Le code des coups : « Un coup, ça veut dire "t'es là ?". Deux, "je suis là". Trois, "bonne nuit". C'est toi qui l'as inventé. » ; frapper 1, 2 ou 3 coups, trois donnent « …Bonne nuit quand même. » | Village, porte du Mouton Noir | `maison_mouton_noir` → `blackSheepHouse`, `chapter1.ts:426` ; drapeaux `c1_code`, `c1_knock` | `lot7-village` |
| T2 / T9 | Mina : « Dodo, c'est le mouton de N— … le mien. LE MIEN. » (3ᵉ réplique) | Village, parler à Mina | `MINA_LINES.village`, `chapter1.ts:1023` | `lot7-village` |
| T3 | Chaussette : « Comme d'habitude ? » ; double : « Je te confonds. Toutes les têtes fatiguées se ressemblent. » | Boutique, parler à Chaussette | `chaussette` → `chaussetteTalk`, `chapter1.ts:534` | `lot7-boutique` |
| — | Nouveau stock : « Yeux de rechange » (deux pour le prix d'un), « Pour les jours où on ne veut pas voir » ; objet de soin (NEUTRE, 10 PV) | Boutique, comptoir | objet `yeux`, `src/data/items.ts:30` | `lot7-boutique` |
| § 5 | Chaussette rachète le Bouton doré : 50 Boutons au comptoir, puis 60 en lui parlant. Vendre est possible et ferme sans rien dire la fin secrète (`c1_bouton_vendu`, lu par `endings.ts › dawnEnding`) ; Mina : « C'est pas grave. C'était qu'un bouton. » | Boutique | `comptoir` → `chaussetteShop`, `sellButton`, `chapter1.ts:497`, `:521`, `:539` | `lot7-boutique` |
| — | Le Moutonnier a les yeux cousus en croix : « Je les ai cousus. C'est plus reposant. » ; il compte à l'oreille (« *dresse une oreille* ») | Colline, devant les oreillers | `moutonnierMeet`, `chapter1.ts:787` ; perso `moutonnier` (`characters.ts:565`), locuteur `moutonnier` | `lot7-colline` |
| T8 | Manche 3 « Les yeux fermés » (existant) ; « Moi, de toute façon, j'ai les yeux fermés » ; « à force de compter, on oublie tout le reste » (existant) | Colline, compter les moutons | `src/game/scenes/sheepcount.ts:69`, `chapter1.ts:636`, `:756` | `v11-sheep` |
| T9 | Derrière un oreiller géant, une petite silhouette en bonnet, de dos ; quand Noa approche, elle n'y est plus (sans un bruit) ; derrière l'oreiller : « Personne. Rien qu'un oreiller. » | Colline, l'oreiller au chocolat | `c1_bonnet` (sprite `npc_bonnet_loin`, `src/data/sprites/chapter6.ts:372`, carte `maps/chapter1.ts:367`), déclencheur `hillSilhouette` (`maps/chapter1.ts:393`, `chapter1.ts:585`), `oreiller_chocolat` (`chapter1.ts:613`) ; drapeau `c1_bonnet_vu` | `lot7-colline` |
| T6 | Le coton tombe sur Noa, il tousse ; Mina : « Te mets pas trop près de moi si t'es enrhumé. Maman dit. », puis « Je rigole ! … Ça rend pas malade, le coton. » ; « Ce n'était pas le froid. » (existant) | Colline, assis avec Mina | `sitWithMina`, `chapter1.ts:886` | `lot7-assis` |
| T8 | « Promis. » (`c1_promesse`, preuve en faveur de la douce, existant) | Colline, assis avec Mina | `chapter1.ts:912` | `lot7-assis` |
| T4 | Le Placard épargné, dernière réplique : « …Je l'ai gardée pour moi, la lumière. J'avais si peur. » | Sommet | `closetBoss`, `chapter1.ts:977` | `lot7-placard` |
| — | Le Placard vaincu fond en encre : « L'encre sent le désinfectant. » | Sommet | `chapter1.ts:980` | `lot7-placard-vaincu` |
| T7 | Dodo : « C'est l'heure de se réveiller… pour l'instant. » (existant) | Fin du chapitre | `chapterEnd`, `chapter1.ts:1002` | `v2_aube` |

## Chapitre 2 — « La Forêt de Crayons » (§ 3.6, lot 7)

Toujours l'acte I : une seule fausse note par endroit, chacune avec son double ordinaire (une réplique de Mina, une
blague, une explication banale). Rien sur l'appel. Tout s'atteint en marchant et en appuyant sur A ; les scripts de debug
`c2_chuchote`, `c2_figure`, `c2_taille`, `c2_bocal` posent Noa à côté, avec Mina (`c2_boutons` montre la frame aux
yeux-boutons à l'arrêt). Les entités portent des ids pour le bot (`trou_chuchote`, `trou_figure`, `c2_bonnet`,
`taille_crayon_geant`, `etagere_illisible`, `etagere_contes`, `carnet_etoiles`, `bocal_miettes`).

| Twist | Indice | Où | Entité / code | Preuve |
|---|---|---|---|---|
| T3 | Mina : « Tu es revenu ! Tu as dormi super longtemps » (existant : la phrase de chaque nuit) | Lisière, arrivée | `intro`, `src/game/story/chapter2.ts:114` | `lot7-lisiere` |
| T7 | Friture sur Dodo dès le ch. 2 : sur « abîmée » et sur le « moi » de « pensez à moi » (balise `{static}`) ; le « Chut. » devient « Ch—t. » | Lisière ; atelier, fin du chapitre | `chapter2.ts:136`, `:147`, `dodoHush` `:1077` | `lot7-lisiere`, `lot7-gomme` |
| T3 | Un trou gommé chuchote des nombres : « …trois cent… soixante… » ; double : Mina, « C'est quelqu'un qui compte les moutons. Faut pas le déranger. Sinon, il doit tout recommencer depuis le début. » ; ensuite « Tu n'arrives jamais à entendre la fin. » | Forêt, trou blanc à l'est du taille-crayon | `trou_chuchote` (`src/data/maps/chapter2.ts:362`) → `erasedHole`, `chapter2.ts:313`, `:321` ; compteur `c2_chuchote` | `lot7-foret` |
| T7 | Mina : « Qui c'est qui parle, quand c'est écrit en blanc ? …Le livre, je parie. » (3ᵉ réplique) | Forêt, parler à Mina | `MINA_LINES.foret`, `chapter2.ts:1137` | `lot7-foret` |
| T9 | Dans l'autre trou gommé, très loin, une toute petite figure au crayon gris, de dos, bonnet à oreilles de mouton ; double : Mina, « C'est un bout de dessin que Gomme a oublié ! Il reste toujours un petit bout, quand on gomme. » ; puis elle n'y est plus (« Gomme est repassée, sûrement. ») | Forêt, trou blanc au sud-ouest | `c2_bonnet` (sprite `prop_bonnet_trou`, `src/data/sprites/props.ts:1941`, carte `maps/chapter2.ts:365`), `trou_figure` → `erasedHoleFigure`, `chapter2.ts:331` ; drapeau `c2_bonnet_vu` | `lot7-foret` |
| § 3.6 | Les copeaux « comme des rognures d'ongles » ; double : Mina en fait des jupes aux fleurs. Tailler l'arbre-crayon rouge voisin (au choix) : l'encre rouge sombre perle de la coupe, coule le long du tronc et fait une flaque ; Mina : « Il saigne ! » puis « C'est un crayon rouge, gros bêta. C'est rouge, dedans. » et le panneau de la Lisière (« ne pas tailler les arbres SVP ») | Forêt, taille-crayon géant | `taille_crayon_geant` (`maps/chapter2.ts:354`) → `sharpener`, `bleedingTree`, `chapter2.ts:353`, `:373` ; particules `Particles.bleed` (`src/game/overworld/particles.ts:53`, gouttes `ooze` puis flaques `pool`) ; drapeaux `c2_copeaux`, `c2_taille` | `lot7-foret` |
| § 6.4 | Avec « Réduire les flashs » : pas de secousse, pas de giclée, seulement des gouttes lentes | Même scène | `bleedingTree` (`gentle`) | `lot7-taille-doux` |
| T3 | Mina se fige : pendant quelques images, face à toi, ses yeux sont deux boutons gris cousus d'une croix de fil rouge ; puis le glitch, et elle finit sa phrase | Forêt, chemin du nord | `minaFreeze`, `chapter2.ts:264`, `:284` ; pose `pose_mina_boutons` (`src/data/sprites/characters.ts:1715`) | `lot7-freeze` |
| T3 | L'étagère des livres que personne ne lit, 2ᵉ examen : un seul livre a servi, chaque page dit « Tu es revenu ! / Tu as dormi super longtemps. », la dernière s'arrête (« super lon ») ; « Tu ne comptes pas les pages. » ; double : Mina, « C'est des lignes ! Comme à l'école » | Bibliothèque | `etagere_illisible` → `shelfUnread`, `chapter2.ts:541`, `:548`–`:550` ; compteur `c2_illisible` | `lot7-bibliotheque` |
| T8 | L'étagère des contes, 2ᵉ examen : un conte sans couverture qui s'arrête au milieu d'une phrase ; le Hibou : « Et celui-ci, quelqu'un l'a écouté à travers un téléphone. Il ne finit pas. » ; double : Mina, « Au téléphone, ça coupe toujours au meilleur moment. Saleté de réseau ! » | Bibliothèque | `etagere_contes` → `shelfTales`, `chapter2.ts:558`, `:565`–`:567` ; compteur `c2_contes` | `lot7-bibliotheque` |
| T1 | Une fois le carnet aux étoiles regardé, le Hibou a un sujet de plus, « Le carnet » : « Ce carnet n'a que trois pays. Le reste, quelqu'un d'autre le gribouille. » ; double : Mina, « Les dernières pages d'un cahier, c'est toujours pour les gribouillis. » (sans elle, le Hibou : « Les cahiers d'enfants finissent souvent comme ça. ») | Bibliothèque, parler au Hibou | `hibou` (sujets `chapter2.ts:484`) → `owlNotebook`, `:511` ; drapeaux `c2_carnet`, `c2_carnet_hibou` | `lot7-bibliotheque` |
| T9 | Les lanternes allumées : dans la lumière bleue, deux fils au-dessus des poignets de Mina, qui montent hors de vue ; doubles : Mina croit à une araignée (« ENLÈVE-LA ! »), le narrateur parle de fils de lumière laissés par les lucioles | Clairière | `lanternsSolved` → `threadsInBlue`, `chapter2.ts:705`, `:728` ; sprite `fx_fils_mina` (`props.ts:1966`) ; drapeau `c2_fils` | `lot7-fils` |
| § 3.6 | Le bocal de miettes de gomme, « À JETER » : « Certaines ont une bouche. » ; double : Mina, « Elles bâillent. C'est l'heure de dormir, pour les miettes. » ; Gomme épargnée, le bocal est ouvert, une miette dort au fond | Atelier de Gomme | `bocal_miettes` (`maps/chapter2.ts:681`, `:682`, sprites `bocalMiettes`, `props.ts:1983`) → `crumbJar`, `chapter2.ts:1103` ; drapeau `c2_bocal` | `lot7-atelier` |
| — | Gomme épargnée : « On efface pour ne plus avoir mal. Ou pour ne plus être coupable. Ce n'est pas pareil. » (contrepoint : elle rend les dessins, existant) | Atelier, après le combat | `gommeSpared`, `chapter2.ts:995` | `lot7-gomme` |
| T6 | Souvenir 2, le dessin inachevé : un petit nuage gris près de la bouche du Noa dessiné, soufflé vers elle (on le prend pour une bulle vide) ; « parce que… PARCE QUE » (existant) | Fin du chapitre | `paintDessin`, `src/data/illustrations.ts:1439` | `lot7-gomme` |

## Chapitre 3 — « L'Hôpital de Papier » (§ 3.8, lot 8)

Fin de l'acte I : l'hôpital est le lieu le plus sombre du carnet de Mina, mais chaque indice garde son double ordinaire
(un masque, une règle d'hygiène, de la barbe à papa, un reflet, un autre enfant). Rien sur l'appel. Tout s'atteint en
marchant et en appuyant sur A ; les scripts de debug `c3_nadia`, `c3_robot`, `c3_voix`, `c3_maman`, `c3_bonnet`,
`c3_aile`, `c3_sas`, `c3_dessin` (`&stage=0..3`), `c3_placard`, `c3_fenetre304`, `bt_bracelet` posent Noa (et Mina) à
côté, sans ennemi errant. Entités pour le bot : `nadia_0`, `nadia_1_0`…`nadia_1_2`, `nadia_2`, `robot`, `porte_19`,
`porte_28`, `porte_37`, `porte_46`, `dessin_0`…`dessin_3`, `fenetre_aile`, `fenetre304`, `placard`.

| Twist | Indice | Où | Entité / code | Preuve |
|---|---|---|---|---|
| T6 | L'infirmière entendue : « Le grand frère qui toussait ? On l'a renvoyé. Pauvre gamin. » ; puis Noa tousse, et le narrateur a une raison toute prête (« La poussière de papier, sûrement. ») ; double : Mina, « Mets ta main devant ta bouche ! C'est la règle, ici. » | Couloir, boucle 1 | `heardNurse`, `src/game/story/chapter3.ts:764`, `:767`, `:777` | `lot8-voix` |
| T6 | Maman au téléphone, nouvelle dernière réplique : « Il croit que c'est lui. Je n'arrive pas à lui dire que non. » | Couloir, boucle 2 | `heardMaman`, `chapter3.ts:781`, `:788` | `lot8-maman` |
| T6 / § 3.8 | Les infirmières en papier, sans visage (un pli au milieu), toutes badgées « NADIA » ; doubles : Mina, « On voyait jamais leur visage, ici. Elles avaient toujours un masque. Et la nuit, c'était toujours Nadia. » ; leurs répliques : « Les visites sont finies, mon grand. Reviens demain. » (accueil), « Suis les dessins. » (couloir), « Ici, on ne ferme jamais tout à fait les portes. Pour la lumière. » (dernière aile : elle n'était pas dans le noir) | Accueil, couloir (une place par boucle), dernière aile | `nadia_0`, `nadia_1_*`, `nadia_2` (`src/data/maps/chapter3.ts:341`) → `paperNurse`, `chapter3.ts:467` ; sprite `npc_infirmiere_papier` (`src/data/sprites/chapter3.ts:34`) ; drapeaux `c3_nadia`, `c3_nadia_0..2` | `lot8-hall`, `lot8-voix`, `lot8-aile` |
| § 3.8 (T2) | « Le chocolat du robot », B4 : le distributeur en papier donne une poignée de coton gris, encore tiède ; double : Mina, « C'est de la barbe à papa ! … Il est en panne, le robot. » ; l'objet `coton_gris` « sent l'hôpital. Et un peu la lessive de chez toi » (la phrase du mouton compteur sur Dodo, ch. 1) ; ensuite, « un bruit de ventre vide » | Accueil, contre le mur | `robot` (`maps/chapter3.ts:317`, sprite `prop_h_robot`) → `vendingRobot`, `chapter3.ts:490` ; objet `coton_gris` (`src/data/items.ts:40`) ; drapeau `c3_robot` | `lot8-hall` |
| § 3.8 (T6) | Les numéros déraillent dans la dernière aile : 307, 306, 305… puis 303½ (le « ½ » ajouté au crayon) : par le hublot, le sas (lavabo, blouses, masques, une autre vitre) ; double : Mina, les règles d'hygiène, « les microbes, c'est le pire ennemi des chevalières » | Dernière aile | `porte_19`…`porte_46` → `corridorDoor`, `LAST_WING`, `room303half`, `chapter3.ts:569`, `:596` ; glyphe `½` (`src/engine/font-data.ts:113`) ; compteur `c3_sas` | `lot8-aile` |
| T6 | Les dessins scotchés : dans un coin de chacun, un petit bonhomme aux cheveux bleus s'approche d'une porte vitrée ; au dernier (à côté de la 304), il est collé contre la vitre, et de l'autre côté une toute petite main est posée à plat ; doubles : Mina, « Je te mets dans tous mes dessins. Comme ça, t'es là. », « Je l'ai dessiné avant. Pour que ça arrive. … Il manque ta main, de ton côté. J'avais plus de bleu. » | Couloir, à côté de la bonne porte, à chaque boucle | `dessin_0`…`dessin_3` → `tapedDrawing`, `chapter3.ts:729` ; sprites `prop_h_dessin_0..3` (`sprites/chapter3.ts:165`) | `lot8-voix`, `lot8-maman`, `lot8-dessin`, `lot8-aile` |
| T9 | Au bout de la boucle, quelqu'un de petit, en bonnet, de dos, tourne le coin (« Il n'y a pas de coin. »), toujours devant, à chaque passage ; double : Mina, un autre enfant, « Ici, y a plein d'enfants qui ont des bonnets. Même quand il fait chaud. » | Couloir, boucles 1 à 3 | déclencheur `x 47` (`maps/chapter3.ts:369`) → `corridorBonnet`, `chapter3.ts:655` ; sprites `npc_bonnet_loin`, `_fondu` ; drapeau `c3_bonnet_vu` | `lot8-bonnet` |
| T9 | « room304Window » : Mina est effacée avant la chambre 304, la vitre est donc celle du couloir de la dernière aile, la nuit : le reflet de Noa, et à côté quelqu'un de plus petit en bonnet à oreilles de mouton, alors que Mina, avec ses couettes, est à côté de lui ; il tourne la tête, le reflet redevient Mina ; double : « J'ai de l'encre sur le nez ? » | Dernière aile, fenêtre à côté de la veilleuse | déclencheur `x 50` (`maps/chapter3.ts:372`) → `wingWindow`, `chapter3.ts:697` ; sprite `fx_reflet_vitre` (`sprites/chapter3.ts:209`) ; drapeau `c3_reflet` | `lot8-aile` |
| T9 | La fenêtre de la 304, 2ᵉ examen : en bas, la buée, à hauteur d'enfant, un dessin du bout du doigt, « Un mouton. Ou un bonnet. C'est difficile à dire. » | Chambre 304 | `fenetre304` → `room304Window`, `chapter3.ts:917`, `:923` ; compteur `c3_fenetre304` | `lot8-fenetre304` |
| T9 | Le Placard épargné : « Le soir, une petite fille au bonnet regarde par ta fenêtre. Elle ne frappe pas. Elle regarde si ta lumière est allumée. » ; double : Mina, « Les placards, ça voit tout de travers. Par le trou de la serrure. C'était sûrement la lune. » | Ruines, marais | `placard` → `placardTalk`, `chapter3.ts:299`, `:305` ; compteur `c3_placard` | `lot8-placard` |
| T6 | Nouvel ennemi, Bracelet (bracelet d'hôpital-ver, Peur) : l'étiquette « MINA — 304 », retournée après la tristesse : « NOA — ??? » ; le mot spécial « prénom » (trop tôt : « Il y en a déjà un. C'est écrit. M… I… N… A. ») imprime « NOA » ; épargné, il se referme sur le poignet de Noa (objet clé cosmétique `bracelet_noa`, « Il n'y a pas de numéro de chambre ») ; vaincu, « Sur aucun des deux, il n'y a plus de nom » | Couloir, boucle 3 (`c3_bracelet_1`) | `src/data/enemies-ch3.ts` (`BRACELET_HOOKS`, `bracelet`) ; motifs `bracelet_wrap`, `bracelet_holes` (`src/game/battle/patterns-ch3.ts`) ; sprites `b_bracelet`, `ow_bracelet` ; drapeau `c3_bracelet` (`epargne` / `coupe`) | `lot8-bracelet`, `lot8-bracelet-coupe`, `lot8-couloir` |
| T8 | Les mots de Dodo dans le combat court sont ceux de l'appel : « dors, reste, oublie, demain, chut » ; « demain » : « Demain. Ici, c'est toujours demain. Il ne vient jamais. » | Le vide, combat contre Dodo, phase 2 | `DODO_WORDS` (`src/data/words.ts:67`), `P2_WORDS`, `DODO_WORD_LINES`, `chapter3.ts:1072`, `:1078` | `lot8-dodo-demain` |
| T4 / T8 | La voix de nuit : « Ton frère va te l'apporter, c'est ça ? » (existant, preuve de la version douce) | Couloir, boucle 3 | `heardNight`, `chapter3.ts:794` | `lot8-existants` |
| T4 | La veilleuse de la 304 : « Elle n'a jamais été branchée. » (existant : c'est Maman qui l'a posée là, après) | Chambre 304 | `nightlight304`, `chapter3.ts:947` | `lot8-existants` |
| T1 | Dodo, trop gentil : « Tu vois ? Tu peux partir quand tu veux. » (lot 5) ; puis le faux message d'erreur (existant) | Le vide ; porte 304 | `dodoReveal`, `chapter3.ts:1011` ; `door304`, `:875` | `lot8-existants`, `v2_aube` |

Équilibrage (lot 8, mesuré avec le bot : esquive au hasard, 14 Étoiles, Plume dorée, Cape de Mina, 32 PV, PV rendus
après chaque tour ennemi ; `bt_acte1`, `c3_battle&acte1`) : PV perdus par combat — Perfusion 2,3 · Bip 5 · Bip +
Perfusion 5,3 (7 tours) · Bracelet 8,5 (après : ATQ 5, cage plus serrée, boucle 3 ; avant : 7,8) · Dodo, combat court,
12,8 sur 6 tours (on ne peut pas y perdre) · chapitre 4 : Pâte Froide 1,8, Dé Chevalier 6 · **La Couseuse 21** (2,5,
3,5 puis 15 au tour de la cage). Sans la cape (plaid) : Bracelet 8,5, Bip + Perfusion 14,8, La Couseuse 46 (mortelle
pour ce bot) ; d'où un coup de pouce vers la salle de jeux dans les répliques de Mina à l'hôpital
(`MINA_LINES.hopital`, `chapter3.ts:1454`).

## Final — « Le carnet », 5 h 52 (§ 3.15, coda § 2.11, lot 9)

Le narrateur dit la vérité (règle 4, à partir du chapitre 6) ; chaque objet garde son double ordinaire (une veilleuse,
un tiroir, des photos, un bonnet, un radiateur). Tout s'atteint en marchant et en appuyant sur A. Scripts de debug :
`finale` (le réveil), `finale_porte` (devant la porte de Mina, clé et veilleuse en main), `finale_room`, `finale_poem`,
`finale_phone` (`&flags=i3_tel,i3_reply=pardon`), `finale_maman`, et une entrée par branche : `finale_aube`,
`finale_reste`, `finale_aube_blanche`, `finale_veilleuse`, `finale_beaux_reves`, `finale_silence`. Entités pour le bot :
`veilleuse`, `bureau`, `photo`, `phone`, `mur` (chambre de Noa) ; `a_porte_mina` (couloir) ; `f_lit`, `f_mur`,
`f_chevet`, `f_veilleuse`, `f_radiateur`, `f_dodo`, `carnet` (chambre de Mina).

| Twist | Indice | Où | Entité / code | Preuve |
|---|---|---|---|---|
| T2 | Au réveil, Dodo a glissé contre Noa : « Tu le prends sous ton bras. Sans y penser. Comme avant. » ; dans la chambre de Mina, il est posé sur le rebord de la fenêtre (comme sur l'illustration `fin_aube`) | Lit de Noa ; fenêtre de Mina | `finale`, `src/game/story/real.ts:1114` ; `minaRoomEnter`, `:1301` ; `f_dodo` (`src/data/maps/real.ts:392`) ; drapeau `fin_dodo` | `lot9a-aube` |
| T4 | La veilleuse a brillé « toutes les nuits, depuis un an » ; débranchée : « Il ne fait pas noir. Pas tout à fait. Plus tout à fait. » (le contraire de 3 h 38) ; « Quelqu'un l'avait enroulé comme ça, il y a un an. Quand elle est revenue de l'hôpital. » ; fêlée si `c4_fele` | Table de nuit de Noa | `veilleuse` → `finaleNightlight`, `real.ts:1141` ; sprites `prop_veilleuse` / `prop_veilleuse_fele` (`maps/real.ts:154`) ; drapeau `fin_veilleuse_prise` | `lot9a-aube`, `lot9a-fele` |
| T8 | Le tiroir : « Tu sais ce qu'il y a dedans. Oui. Tu sais. » (le prologue disait « Non. Tu ne sais pas. ») ; « Il n'a jamais été fermé à clé. Il fallait juste tirer. » ; la clé de la chambre de Mina, une douzaine de petits visages découpés, les siens ; [Remettre ton visage sur la photo ?] → `photo_decoupee` puis `photo_famille`, « Tu avais oublié que tu souriais comme ça. » (double : des photos) | Bureau ; photo au sol | `bureau` → `finaleDesk`, `real.ts:1163` ; `offerFace`, `:1188` ; `photo`, drapeaux `fin_tiroir`, `fin_visage` | `lot9a-aube`, `lot9a-fele` |
| § 3.15 | Le téléphone : Maman, « Je rentre. » ; si `i3_reply` = `pardon`, l'inconnue : « Je suis désolée. Écrivez si ça aide. Je ne répondrai pas. Bonne nuit. » (une adulte qui pose une limite, puis répond avec gentillesse) | Téléphone | `phone` → `finalePhone`, `finaleContacts`, `real.ts:1208`, `:1233` ; fil « Mina 🐑 » repris de `real-nuit.ts` (`minaThread`) ; drapeaux `fin_tel`, `fin_inconnue` | `lot9a-aube` |
| T4 | La porte de Mina, fermée à clé ; sans la veilleuse : « Mais elle avait demandé quelque chose. Le dernier soir. » ; Noa frappe trois coups, silence, trois coups de l'intérieur (double : le tuyau du radiateur longe son mur) | Couloir à l'aube | `a_porte_mina` → `finaleMinaDoor`, `real.ts:1263` ; porte ouverte `a_porte_mina_h/_b` (`maps/real.ts:342`) ; drapeau `fin_porte` | `lot9a-aube` |
| T9 | Le bonnet tricoté à oreilles de mouton, posé sur l'oreiller : « Tu l'as déjà vu. Une fois. Derrière une vitre. » | Lit de Mina | `f_lit` → `minaBed`, `real.ts:1319` ; sprite `prop_bed_mina_bonnet` (`src/data/sprites/props.ts:2608`) | `lot9a-aube` |
| — | La peinture usée à hauteur d'oreiller : « Comme si quelqu'un avait frappé là. Souvent. » ; « De l'autre côté de ce mur, il y a ton lit. » | Mur au-dessus du lit (répond au pied du lit) | `f_mur` → `minaWall`, `real.ts:1336` ; sprite `prop_mur_use_mina` | `lot9a-aube` |
| — | Le radiateur sous la fenêtre, son tuyau longe le mur jusqu'à la chambre de Noa ; « Le chauffage ne s'est pas encore remis en route. » | Sous la fenêtre de Mina | `f_radiateur` → `minaRadiator`, `real.ts:1345` | `lot9a-aube` |
| T4 | La prise de sa table de nuit : « Rien de branché. Depuis le soir où elle est partie à l'hôpital. » ; la veilleuse branchée : « Le geste que tu n'as pas fait. » ; fêlée, elle brille quand même | Table de nuit de Mina | `f_chevet` → `minaNightlight`, `plugIn`, `real.ts:1354`, `:1371` ; drapeau `fin_plugged` | `lot9a-aube`, `lot9a-fele` |
| T4 | La dernière page du carnet se relit : « Sur le dessin, un garçon dort. La veilleuse est branchée à côté de son lit à lui. » — « Elle savait. Elle a toujours su qui avait peur du noir. » | Bureau de Mina | `carnet`, `real.ts:1400` | `lot9a-aube` |
| Coda | Maman : « Tu es réveillé. » ; Noa : « Je l'avais. La veilleuse. » ; « Je savais » (la lumière sous la porte, le réveil à cinq heures, « je savais que tu ne dormais pas », « Alors j'ai fait semblant aussi. Un an. ») ; le dos du mot du frigo complété : « Je sais que tu ne dormais pas. » | Chambre de Mina | `mamanComesHome`, `real.ts:1433`, `:1466`, `:1469`, `:1476` ; au frigo, après l'Interlude IV : « Au dos, sous les ratures : « Je sais que t— ». », `real.ts:898` | `lot9a-aube`, `lot9a-aube-blanche` |
| T6 / T8 | L'appel et le rhume : « J'ai vu le téléphone. Trois heures quatorze. » ; « Je lui ai dit « dors ». » — « …C'est ce que je lui disais tous les soirs. » ; « avec ses globules, ça pouvait venir de partout » ; « Mais tu sais pas. » — « …Non. Je sais pas. Moi aussi je me demande. » ; « Elle n'était pas dans le noir. Nadia lui tenait la main. » | Chambre de Mina | `theCallAndTheCold`, `real.ts:1516` | `lot9a-aube` |
| § 5 | Aube blanche : l'appel et le rhume remplacés par « J'étais là, à la fin. Je lui tenais la main. » — « …Oui. Oui, mon grand. » (elle ment pour lui, une deuxième fois ; Nadia n'est plus nommée) | Chambre de Mina | `whiteMemory`, `real.ts:1534` | `lot9a-aube-blanche` |
| § 3.15 | `c4_reste` : Maman s'arrête sur le seuil, « Je ne savais pas si j'avais le droit. » | Seuil de la chambre de Mina | `real.ts:1454` | `lot9a-reste` |
| § 5 | Veilleuse : toutes les conditions réunies, Dodo sur le rebord, « Dans sa patte gauche, sous le tissu, quelque chose de rond. Comme un bouton. » [Découdre Dodo ?] → `endingVeilleuse` ; « Le laisser » → l'Aube | Chambre de Mina | `offerUnstitch`, `real.ts:1560` ; `dawnEnding()` (`src/game/story/endings.ts:131`) ; drapeau `fin_ending` | `lot9a-veilleuse`, `lot9a-veilleuse-laisser` |
| — | Le radiateur cogne trois fois : « C'est le chauffage. Mina disait que c'était toi. » — « …Je sais. » | Chambre de Mina | `radiatorKnocks`, `real.ts:1568` | `lot9a-veilleuse-laisser`, `v2_aube` |

## Fins et épilogue (§ 5, § 3.16, lot 9)

Les cinq fins se rejouent par debug : `fin_aube`, `fin_aube_blanche`, `fin_veilleuse`, `fin_beaux_reves`,
`fin_silence` (`src/game/story/endings.ts`, `DEBUG`), et l'épilogue v2 entier par `epilogue_v2`
(`&flags=fin_ending=aube_blanche|veilleuse`). Entités pour le bot : `coquillage`, `dodo_plush` (sur la pierre),
`f_dodo_recousu` (chambre de Mina), `br_mot_0…2` (les mots sur la porte), `s_pancarte` (le débarras).

| Twist | Indice | Où | Entité / code | Preuve |
|---|---|---|---|---|
| T2 / T7 | La voix off de fin garde le nom « Dodo » avec le bip de Noa (« Je veillerai sur lui. Pour de vrai, cette fois. ») ; après la fin secrète (`meta.dodoSilent`), elle n'a plus de nom | Épilogue, écran noir | `goHome`, `src/game/story/epilogue.ts:543` | `lot9b-aube` |
| T7 | Dodo muet : « Rien. Pas un grésillement. La pile est morte. » — « Il ne dit plus rien. Tu le prends quand même. » (double : une pile morte) | Avant la boutique | `dodoInBag`, `epilogue.ts:132` | `lot9b-aube` |
| § 5 | Aube blanche : le poème écrit tout seul « j'étais là » au stylo bleu (« 7/6 ») ; « Tu ne te souviens pas de l'avoir écrite. Elle a l'air vraie. » (double : écrit à moitié endormi) ; le soleil est un rond de correcteur (`fin_aube_blanche`) ; « Je venais tous les jours. », Maman ne dit rien ; « Beaux rêves, {player}. » | Chambre de Mina ; pierre | `PoemScene` (`opts.extra`, `src/game/scenes/poem.ts`) ; `carnet`, `src/game/story/real.ts:1409` ; `endingAubeBlanche`, `endings.ts:154` ; `mamanJoins`, `epilogue.ts:500` | `lot9b-aube-blanche` |
| Secret | Le découd-vite (« Tu vas l'abîmer. » — « Je vais le réparer. »), le dessin fini `lune_finie` (« FINI. (sans toi mais avec toi) », le grand frère sans masque), la piste 1 nette avec la pile du réveil, la piste 2 sous le bouton doré (« C'est pas toi qui m'as rendue malade, gros bêta. », enregistrée avant la dernière nuit), « Elle savait pas, pour l'appel. » — « Non. Mais elle te connaissait. », trois coups au mur et le radiateur répond, Dodo recousu au fil bleu ; à l'épilogue, laissé sur la pierre, puis les dessins de Mina | Chambre de Mina ; pierre | `endingVeilleuse`, `endings.ts:173` ; `dodoMoment`, `epilogue.ts:452` ; drapeaux `fin_decousu`, `fin_piste1`, `fin_piste2`, `fin_recousu` | `lot9b-veilleuse` |
| § 5 | Beaux rêves : « Tu n'auras plus mal. » puis, à l'écran, le contraire (« Ce n'était pas vrai. Ça fait mal pareil. ») ; les mots sur la porte (15 ans, « 16. », « Je t'aime. »), « …Merci. » à travers la porte, la pile qui meurt sur « beaux rê— », un garçon de seize ans vivant (`fin_beaux_reves`) ; le titre « Continuer » ramène au chapitre 1 : « Tu es revenu ! Tu as dormi super longtemps. », 365 bâtons comptés | Couloir (`appartement_br`) ; prairie | `endingBeauxReves`, `hallwayYears`, `endings.ts:307`, `:343` ; `meetMina`, `dreamBed` (`chapter1.ts`, drapeau `br_retour`) | `lot9b-beaux-reves`, `lot9b-retour` |
| § 5 | Silence : la porte de Mina devenue « DÉBARRAS » (sans plaque, la trace des lettres décollées sur `fin_silence`), sa chaise et son coffre disparus, « Ta sœur aurait eu neuf ans cette année. » — « Qui ? », trois coups dans le débarras (double : le radiateur), « Personne ne bouge. » ; son prénom devient « ______ » dans les menus, le Carnet de souvenirs et les poèmes tant que Silence est la dernière fin | Couloir (`appartement_silence`) ; titre | `endingSilence`, `endings.ts:403` ; `silenced`, `src/game/ui/share.ts:38` | `lot9b-silence` |
| § 3.16 | L'inconnue, au portail : « Bonne journée. » (Noa ne répond pas : elle avait demandé d'arrêter) ; le quarante-deuxième coquillage posé sur la pierre (« Dans sa chambre, peut-être. ») | Jardin | `strangerGoodDay`, `epilogue.ts:264` ; `shell42`, `:389` | `lot9b-aube` |
| § 5 | La « Fin heureuse » (laisser défiler le faux générique) n'est jamais enregistrée : ni `endings`, ni `lastEnding`, ni `nuits` | Faux générique | `fausse-aube.ts` (aucun `finishGame`) | `lot9b-fin-heureuse` |

## Encore à faire par les lots suivants

| Twist | Indice | Où | Lot |
|---|---|---|---|
| T4 / T5 / coda | `bonus.ts` › `noaDoor` : la lumière sous la porte, « Il dort. Enfin. Cinq heures, ça ira. », Maman frappe et personne ne répond | Bonus | 11 |
| T7 | Le bip de Dodo pour le narrateur entre minuit et 5 h (heure réelle) | Méta | 10 |
| § 5 | La vibration de 3 h 14 pendant un interlude (« Mina 🐑 — appel entrant », puis « appel manqué ») | Méta | 10 |
