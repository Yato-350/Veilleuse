# Liste de contrôle des indices

Chaque indice que la bible (`docs/HISTOIRE.md`, § 2.2 à § 2.11, § 3.3, § 3.5, § 3.7, § 4 « Monde réel », § 5) place
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
| — | Nouveau stock : « Yeux de rechange » (deux pour le prix d'un), « Pour les jours où on ne veut pas voir » ; objet de soin (NEUTRE, 10 PV) | Boutique, comptoir | objet `yeux`, `src/data/items.ts:32` | `lot7-boutique` |
| § 5 | Chaussette rachète le Bouton doré : 50 Boutons au comptoir, puis 60 en lui parlant. Vendre est possible et ferme sans rien dire la fin secrète (`c1_bouton_vendu`, lu par `endings.ts › dawnEnding`) ; Mina : « C'est pas grave. C'était qu'un bouton. » | Boutique | `comptoir` → `chaussetteShop`, `sellButton`, `chapter1.ts:497`, `:521`, `:539` | `lot7-boutique` |
| — | Le Moutonnier a les yeux cousus en croix : « Je les ai cousus. C'est plus reposant. » ; il compte à l'oreille (« *dresse une oreille* ») | Colline, devant les oreillers | `moutonnierMeet`, `chapter1.ts:787` ; perso `moutonnier` (`characters.ts:565`), locuteur `moutonnier` | `lot7-colline` |
| T8 | Manche 3 « Les yeux fermés » (existant) ; « Moi, de toute façon, j'ai les yeux fermés » ; « à force de compter, on oublie tout le reste » (existant) | Colline, compter les moutons | `src/game/scenes/sheepcount.ts:69`, `chapter1.ts:636`, `:756` | `v11-sheep` |
| T9 | Derrière un oreiller géant, une petite silhouette en bonnet, de dos ; quand Noa approche, elle n'y est plus (sans un bruit) ; derrière l'oreiller : « Personne. Rien qu'un oreiller. » | Colline, l'oreiller au chocolat | `c1_bonnet` (sprite `npc_bonnet_loin`, `src/data/sprites/chapter6.ts:372`, carte `maps/chapter1.ts:367`), déclencheur `hillSilhouette` (`maps/chapter1.ts:393`, `chapter1.ts:585`), `oreiller_chocolat` (`chapter1.ts:613`) ; drapeau `c1_bonnet_vu` | `lot7-colline` |
| T6 | Le coton tombe sur Noa, il tousse ; Mina : « Te mets pas trop près de moi si t'es enrhumé. Maman dit. », puis « Je rigole ! … Ça rend pas malade, le coton. » ; « Ce n'était pas le froid. » (existant) | Colline, assis avec Mina | `sitWithMina`, `chapter1.ts:886` | `lot7-assis` |
| T8 | « Promis. » (`c1_promesse`, preuve en faveur de la douce, existant) | Colline, assis avec Mina | `chapter1.ts:912` | `lot7-assis` |
| T4 | Le Placard épargné, dernière réplique : « …Je l'ai gardée pour moi, la lumière. J'avais si peur. » | Sommet | `closetBoss`, `chapter1.ts:977` | `lot7-placard` |
| — | Le Placard vaincu fond en encre : « L'encre sent le désinfectant. » | Sommet | `chapter1.ts:980` | `lot7-placard-vaincu` |
| T7 | Dodo : « C'est l'heure de se réveiller… pour l'instant. » (existant) | Fin du chapitre | `chapterEnd`, `chapter1.ts:1002` | `v2_aube` |

## Encore à faire par les lots suivants

| Twist | Indice | Où | Lot |
|---|---|---|---|
| T2 | Épilogue : « Je veillerai sur lui. Pour de vrai, cette fois. » (existant, `src/game/story/epilogue.ts:459`) | Épilogue | 9 |
| T9 | Le bonnet posé sur l'oreiller | Final, `chambre_mina` | 9 |
| Coda | Maman complète le dos du mot du frigo ; « Je savais » | Final | 9 |
| T4 / T5 / coda | `bonus.ts` › `noaDoor` : la lumière sous la porte, « Il dort. Enfin. Cinq heures, ça ira. », Maman frappe et personne ne répond | Bonus | 11 |
| T7 | Le bip de Dodo pour le narrateur entre minuit et 5 h (heure réelle) | Méta | 10 |
| § 5 | La vibration de 3 h 14 pendant un interlude (« Mina 🐑 — appel entrant », puis « appel manqué ») | Méta | 10 |
