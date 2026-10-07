import type { Emotion } from '../engine/palette';

export interface ItemDef {
  id: string;
  name: string;
  desc: string;
  heal?: number;
  /** Sets the soul emotion when used in battle. */
  emotion?: Emotion;
  key?: boolean;
  /** Key item that can be used (not consumed) from the battle OBJET menu. */
  battleKey?: boolean;
  price?: number;
  /** Text shown when used. */
  useText?: string;
}

export const ITEMS: Record<string, ItemDef> = {
  bonbon: { id: 'bonbon', name: 'Bonbon fraise', desc: 'Un bonbon rose, un peu collant. Rend 6 PV.', heal: 6, price: 4, useText: 'Ça colle aux dents. Tu te sens un peu mieux.' },
  lait: { id: 'lait', name: 'Lait chaud', desc: 'Avec du miel, comme Maman le faisait. Rend 12 PV.', heal: 12, price: 8, useText: 'La chaleur descend jusqu\'au ventre.' },
  biscuit: { id: 'biscuit', name: 'Biscuit étoile', desc: 'Un sablé en forme d\'étoile. Rend 8 PV et donne de la JOIE.', heal: 8, emotion: 'joie', price: 10, useText: 'Croc ! Il a le goût des dimanches.' },
  chocolat: { id: 'chocolat', name: 'Chocolat chaud', desc: 'Une tasse fumante. Rend 20 PV.', heal: 20, price: 15, useText: 'Tu as une moustache de chocolat.' },
  gateau: { id: 'gateau', name: 'Part de gâteau', desc: 'Gâteau d\'anniversaire. Huit bougies. Rend tous les PV.', heal: 999, price: 30, useText: 'Joyeux anniversaire… à qui, déjà ?' },
  mouchoir: { id: 'mouchoir', name: 'Mouchoir', desc: 'Doux et brodé d\'une lune. Calme le cœur (NEUTRE) et rend 3 PV.', heal: 3, emotion: 'neutre', price: 5, useText: 'Tu essuies tes yeux. Respire.' },
  bulles: { id: 'bulles', name: 'Bulles de savon', desc: 'Un petit flacon. Donne de la JOIE.', emotion: 'joie', price: 6, useText: 'Les bulles éclatent en riant.' },
  pluie: { id: 'pluie', name: 'Flacon de pluie', desc: 'Il pleut à l\'intérieur. Donne de la TRISTESSE.', emotion: 'tristesse', price: 6, useText: 'Une petite pluie tombe sur ton cœur.' },
  orage: { id: 'orage', name: 'Bocal d\'orage', desc: 'Ça gronde là-dedans. Donne de la COLÈRE.', emotion: 'colere', price: 6, useText: 'Le tonnerre roule dans ta poitrine.' },
  pomme: { id: 'pomme', name: 'Pomme d\'amour', desc: 'Rouge et brillante, comme à la fête foraine. Rend 15 PV.', heal: 15, price: 12, useText: 'Le caramel craque sous la dent.' },
  // Key items
  veilleuse_poche: { id: 'veilleuse_poche', name: 'Veilleuse de poche', desc: 'Une toute petite lune qui brille. Pour ceux qui ont peur du noir.', key: true, battleKey: true },
  ballon: { id: 'ballon', name: 'Ballon rouge', desc: 'Il tire doucement vers le haut, comme s\'il voulait rentrer chez lui.', key: true },
  chaussette_bleue: { id: 'chaussette_bleue', name: 'Chaussette bleue', desc: 'Une chaussette à pois. Toute seule.', key: true },
  cle_mina: { id: 'cle_mina', name: 'Petite clé', desc: 'Une clé avec un porte-clés en forme d\'étoile.', key: true },
  crayons: { id: 'crayons', name: 'Boîte de crayons', desc: 'Il manque le jaune.', key: true },
  crayon_jaune: { id: 'crayon_jaune', name: 'Crayon jaune', desc: 'Le jaune des soleils de Mina.', key: true },
  dessin: { id: 'dessin', name: 'Dessin plié', desc: 'Un dessin de Mina, plié en quatre.', key: true },
};

export function itemName(id: string): string {
  return ITEMS[id]?.name ?? id;
}
