# Liste de contrôle des indices — monde réel

Chaque indice que la bible (`docs/HISTOIRE.md`, § 2.2 à § 2.11, § 3.3, § 3.5, § 3.7, § 4 « Monde réel », § 5) place
dans le monde réel : prologue, interludes I à IV, fausse aube, final, épilogue, bonus et mémoire méta. Pour chacun :
où il se trouve dans le jeu (fichier:ligne au moment du lot 6, identifiant d'entité pour le bot) et le scénario du bot
qui le prouve (`tools/scenarios/`). Les indices des chapitres 1 à 3 sont ceux des lots 7 et 8.

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

## Encore à faire par les lots suivants

| Twist | Indice | Où | Lot |
|---|---|---|---|
| T2 | Épilogue : « Je veillerai sur lui. Pour de vrai, cette fois. » (existant, `src/game/story/epilogue.ts:459`) | Épilogue | 9 |
| T9 | Le bonnet posé sur l'oreiller | Final, `chambre_mina` | 9 |
| Coda | Maman complète le dos du mot du frigo ; « Je savais » | Final | 9 |
| T4 / T5 / coda | `bonus.ts` › `noaDoor` : la lumière sous la porte, « Il dort. Enfin. Cinq heures, ça ira. », Maman frappe et personne ne répond | Bonus | 11 |
| T7 | Le bip de Dodo pour le narrateur entre minuit et 5 h (heure réelle) | Méta | 10 |
| § 5 | La vibration de 3 h 14 pendant un interlude (« Mina 🐑 — appel entrant », puis « appel manqué ») | Méta | 10 |
